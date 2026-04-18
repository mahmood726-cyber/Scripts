################################################################################
# Hackshaw Dataset Deep Dive
# Investigating the -81.2 pp CV divergence
################################################################################

library(metafor)
library(metadat)

# Load data
data(dat.hackshaw1998, package = "metadat")
df <- dat.hackshaw1998
keep <- complete.cases(df$yi, df$vi, df$country)
df <- df[keep, ]

cat("="*80, "\n")
cat("HACKSHAW DATASET INVESTIGATION\n")
cat("="*80, "\n\n")

# Basic characteristics
cat("1. SAMPLE SIZE AND DESIGN\n")
cat(sprintf("   Total studies: %d\n", nrow(df)))
cat(sprintf("   Countries: %d unique\n", length(unique(df$country))))
cat("\n   Country distribution:\n")
print(table(df$country))
cat(sprintf("\n   k/p ratio: %.1f (p=%d effective moderators)\n", 
            nrow(df)/length(unique(df$country)), length(unique(df$country))))

# Check design matrix rank
X <- model.matrix(~ country, data = df)
cat(sprintf("\n   Design matrix: %d rows × %d columns\n", nrow(X), ncol(X)))
cat(sprintf("   Matrix rank: %d (should be %d for full rank)\n", 
            qr(X)$rank, ncol(X)))
cat(sprintf("   Rank deficiency: %s\n", 
            ifelse(qr(X)$rank < ncol(X), "YES - PROBLEM!", "No")))

# Weight diagnostics
cat("\n2. WEIGHT DISTRIBUTION\n")
tau2_null <- rma(yi = df$yi, vi = df$vi)$tau2
w <- 1/(df$vi + tau2_null)
w_norm <- w/sum(w)

cat(sprintf("   Weight range: %.6f to %.6f (%.1fx difference)\n", 
            min(w_norm), max(w_norm), max(w_norm)/min(w_norm)))
cat(sprintf("   Weight CV: %.3f (threshold: 0.6)\n", sd(w_norm)/mean(w_norm)))
cat(sprintf("   Weight Gini: %.3f\n", {
    w_sorted <- sort(w_norm)
    n <- length(w_sorted)
    (2 * sum(w_sorted * seq_len(n)) / (n * sum(w_sorted))) - (n + 1) / n
}))
cat(sprintf("   Max/Median ratio: %.1f (anchor threshold: 50)\n", 
            max(w_norm)/median(w_norm)))

cat("\n   Top 5 weights:\n")
top_idx <- order(w_norm, decreasing = TRUE)[1:5]
for (i in top_idx) {
    cat(sprintf("     Study %2d (%s): w=%.4f, v=%.4f, y=%.3f\n", 
                i, df$country[i], w_norm[i], df$vi[i], df$yi[i]))
}

cat("\n   Bottom 5 weights:\n")
bot_idx <- order(w_norm)[1:5]
for (i in bot_idx) {
    cat(sprintf("     Study %2d (%s): w=%.4f, v=%.4f, y=%.3f\n", 
                i, df$country[i], w_norm[i], df$vi[i], df$yi[i]))
}

# Check for singleton countries
cat("\n3. SINGLETON COUNTRIES (studies that are alone in their country)\n")
country_counts <- table(df$country)
singletons <- names(country_counts[country_counts == 1])
if (length(singletons) > 0) {
    cat(sprintf("   WARNING: %d countries with only 1 study!\n", length(singletons)))
    cat("   These countries:\n")
    for (ctry in singletons) {
        idx <- which(df$country == ctry)
        cat(sprintf("     %s: Study %d, y=%.3f, v=%.4f\n", 
                    ctry, idx, df$yi[idx], df$vi[idx]))
    }
} else {
    cat("   No singleton countries\n")
}

# Check LOO-CV stability
cat("\n4. LOO-CV STABILITY TEST\n")
cat("   Testing what happens when we remove each study...\n\n")

n_failures <- 0
failure_details <- list()

for (i in 1:nrow(df)) {
    X_loo <- model.matrix(~ country, data = df[-i, ])
    rank_loo <- qr(X_loo)$rank
    
    if (rank_loo < ncol(X_loo)) {
        n_failures <- n_failures + 1
        failure_details[[length(failure_details) + 1]] <- list(
            fold = i,
            country = df$country[i],
            rank = rank_loo,
            expected_rank = ncol(X_loo)
        )
    }
}

cat(sprintf("   LOO folds with rank deficiency: %d/%d (%.1f%%)\n", 
            n_failures, nrow(df), 100*n_failures/nrow(df)))

if (n_failures > 0) {
    cat("\n   First 5 problematic folds:\n")
    for (i in 1:min(5, length(failure_details))) {
        f <- failure_details[[i]]
        cat(sprintf("     Fold %2d (country=%s): rank=%d/%d\n", 
                    f$fold, f$country, f$rank, f$expected_rank))
    }
}

# Test alternative specifications
cat("\n5. ALTERNATIVE MODERATOR SPECIFICATIONS\n")

# Option A: Collapse to binary (Europe vs Other)
cat("\n   Option A: Binary Europe vs Other\n")
df$europe <- ifelse(df$country %in% c("UK", "Germany", "Sweden", "Greece", 
                                       "France", "Italy", "Spain"), 
                    "Europe", "Other")
X_binary <- model.matrix(~ europe, data = df)
cat(sprintf("     Design matrix: %d × %d\n", nrow(X_binary), ncol(X_binary)))
cat(sprintf("     Matrix rank: %d/%d\n", qr(X_binary)$rank, ncol(X_binary)))

fit_binary <- rma(yi = df$yi, vi = df$vi, mods = ~ europe, data = df)
cat(sprintf("     Apparent R²: %.1f%%\n", 
            100 * pmax(0, 1 - fit_binary$tau2 / tau2_null)))

# Option B: Drop singleton countries
cat("\n   Option B: Drop singleton countries\n")
df_no_single <- df[df$country %in% names(country_counts[country_counts > 1]), ]
cat(sprintf("     Remaining studies: %d/%d\n", nrow(df_no_single), nrow(df)))
X_no_single <- model.matrix(~ country, data = df_no_single)
cat(sprintf("     Design matrix: %d × %d\n", nrow(X_no_single), ncol(X_no_single)))
cat(sprintf("     Matrix rank: %d/%d\n", qr(X_no_single)$rank, ncol(X_no_single)))

# Option C: Year as continuous
cat("\n   Option C: Use publication year (continuous)\n")
if ("year" %in% names(df)) {
    X_year <- model.matrix(~ year, data = df)
    cat(sprintf("     Design matrix: %d × %d\n", nrow(X_year), ncol(X_year)))
    cat(sprintf("     Matrix rank: %d/%d\n", qr(X_year)$rank, ncol(X_year)))
    
    fit_year <- rma(yi = df$yi, vi = df$vi, mods = ~ year, data = df)
    cat(sprintf("     Apparent R²: %.1f%%\n", 
                100 * pmax(0, 1 - fit_year$tau2 / tau2_null)))
}

cat("\n")
cat("="*80, "\n")
cat("DIAGNOSIS COMPLETE\n")
cat("="*80, "\n")
