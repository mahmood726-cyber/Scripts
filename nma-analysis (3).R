# ============================================================================
# NMA Pro v6.2 - Complete R Equivalent Code
# Generated: 02/01/2026, 14:52:09
# Effect Measure: OR
# Reference: A
# ============================================================================
# NMA Pro Results (for verification):
#   tau2 = 0.427191
#   I2   = 84.5%
# ============================================================================

# Required packages
library(netmeta)
library(meta)       # For publication bias tests
library(metafor)    # For advanced heterogeneity estimators

# ============================================================================
# 1. DATA PREPARATION
# ============================================================================
studies <- data.frame(
  study = c("Study1", "Study2", "Study3", "Study4", "Study5", "Study6", "Study7", "Study8", "Study9", "Study10", "Study11", "Study12"),
  treat1 = c("A", "A", "A", "A", "A", "B", "B", "C", "A", "A", "B", "C"),
  treat2 = c("B", "B", "C", "C", "D", "C", "D", "D", "B", "D", "C", "D"),
  event1 = c(9, 79, 18, 8, 75, 2, 58, 1, 3, 1, 15, 8),
  n1 = c(140, 702, 671, 116, 731, 106, 549, 33, 100, 76, 200, 150),
  event2 = c(23, 77, 21, 19, 363, 9, 237, 9, 17, 32, 22, 25),
  n2 = c(140, 694, 535, 149, 714, 205, 1561, 48, 98, 74, 198, 148),
  year = c(2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021)
)

# Convert to pairwise format
pw <- pairwise(treat = list(treat1, treat2),
               event = list(event1, event2),
               n = list(n1, n2),
               studlab = study,
               data = studies,
               sm = "OR")

# ============================================================================
# 2. NETWORK META-ANALYSIS (Graph-theoretical approach, Rucker 2012)
# ============================================================================
net <- netmeta(TE, seTE, treat1, treat2, studlab,
               data = pw,
               sm = "OR",
               reference.group = "A",
               common = FALSE,
               random = TRUE,
               prediction = TRUE)  # Prediction intervals (IntHout 2016)

# Summary results
summary(net)

# ============================================================================
# 3. HETEROGENEITY ASSESSMENT
# ============================================================================
cat("\n=== Heterogeneity ===\n")
cat("tau2 =", net$tau2, "\n")
cat("tau  =", net$tau, "\n")
cat("I2   =", net$I2 * 100, "%\n")
cat("Q    =", net$Q, ", df =", net$df.Q, ", p =", 1 - pchisq(net$Q, net$df.Q), "\n")

# ============================================================================
# 4. TREATMENT RANKING (P-scores, Rucker & Schwarzer 2015)
# ============================================================================
ranking <- netrank(net, small.values = "desirable")
print(ranking)

# ============================================================================
# 5. INCONSISTENCY ASSESSMENT
# ============================================================================
# Node-splitting (Dias 2010)
cat("\n=== Node-Splitting Inconsistency Test ===\n")
ns <- netsplit(net)
print(ns)

# ============================================================================
# 6. VISUALIZATIONS
# ============================================================================
# Forest plot
forest(net, reference.group = "A",
       sortvar = TE, prediction = TRUE)

# Network graph
netgraph(net, plastic = FALSE, multiarm = TRUE,
         number.of.studies = TRUE)

# Funnel plot (comparison-adjusted)
funnel(net)

# ============================================================================
# 7. PUBLICATION BIAS (Egger 1997)
# ============================================================================
# Comparison-adjusted funnel plot test
# Note: funnel.netmeta() provides visual assessment

# ============================================================================
# 8. LEAGUE TABLE
# ============================================================================
league <- netleague(net, digits = 3)
print(league$random)

# ============================================================================
# END OF ANALYSIS
# ============================================================================
cat("\n=== Analysis Complete ===\n")
cat("This R code replicates NMA Pro v6.2 analysis using netmeta package\n")
cat("Reference: Rucker G, Schwarzer G. (2015) Ranking treatments in frequentist NMA. BMC Med Res Methodol.\n")
