suppressPackageStartupMessages({
  if (!requireNamespace("lavaan",   quietly=TRUE)) install.packages("lavaan",   repos="https://cloud.r-project.org")
  if (!requireNamespace("semTools", quietly=TRUE)) install.packages("semTools", repos="https://cloud.r-project.org")
  if (!requireNamespace("haven",    quietly=TRUE)) install.packages("haven",    repos="https://cloud.r-project.org")
  if (!requireNamespace("ggplot2",  quietly=TRUE)) install.packages("ggplot2",  repos="https://cloud.r-project.org")
  if (!requireNamespace("psych",    quietly=TRUE)) install.packages("psych",    repos="https://cloud.r-project.org")
  library(lavaan); library(semTools); library(haven); library(ggplot2); library(psych)
})
options(stringsAsFactors=FALSE)

# ---------- Helpers ----------
numfix <- function(x) suppressWarnings(as.numeric(gsub(",", "", as.character(x))))
winsor <- function(x, p=0.005) {
  if (all(is.na(x))) return(x)
  q <- stats::quantile(x, c(p, 1-p), na.rm=TRUE)
  x[x < q[1]] <- q[1]; x[x > q[2]] <- q[2]; x
}
zfix <- function(x) as.numeric(scale(x))

safe_cfa <- function(model, data, ...) {
  tryCatch(suppressWarnings(cfa(model, data=data, ...)),
           error=function(e) NULL)
}
safe_sem <- function(model, data, ...) {
  tryCatch(suppressWarnings(lavaan(model, data=data, ...)),
           error=function(e) NULL)
}

# ---------- Load data ----------
d2 <- read_dta("/content/dataset2.dta")
d3 <- tryCatch(read.csv("/content/dataset3.csv", stringsAsFactors=FALSE), error=function(e) NULL)

vars <- c("hiv_dah_23","mal_dah_23","tb_dah_23","ncd_dah_23","rmh_dah_23","nch_dah_23")
structs <- c("dah_23","year")

# EFA dataset: prefer CSV if present
if (!is.null(d3)) {
  for (v in intersect(vars, names(d3))) d3[[v]] <- numfix(d3[[v]])
  efa_df <- na.omit(d3[, vars, drop=FALSE])
} else {
  for (v in intersect(vars, names(d2))) d2[[v]] <- numfix(d2[[v]])
  efa_df <- na.omit(d2[, vars, drop=FALSE])
}

# ---------- EFA ----------
cat("\\n=== EFA (2-factor, varimax) ===\\n")
KMO_val <- tryCatch(psych::KMO(efa_df)$MSA, error=function(e) NA_real_)
B <- tryCatch(psych::cortest.bartlett(cor(efa_df), n=nrow(efa_df)), error=function(e) NULL)
if (is.null(B)) cat(sprintf("KMO=%.3f, Bartlett: NA\\n", KMO_val)) else
  cat(sprintf("KMO=%.3f, Bartlett: chi2=%.1f, p=%.1e\\n", KMO_val, B$chisq, B$p.value))

efa_res <- psych::fa(efa_df, nfactors=2, rotate="varimax")
print(efa_res$loadings)

# Figure: EFA loadings (Factor 1)
lf <- as.data.frame(unclass(efa_res$loadings)); lf$var <- rownames(lf)
p_load <- ggplot(lf, aes(x=reorder(var, MR1), y=MR1)) +
  geom_point(size=3) + coord_flip() + theme_minimal() +
  labs(x=NULL, y="Loading on Factor 1", title="EFA Loadings (Factor 1)")
ggsave("/content/fig_loadings_forest.png", p_load, width=6, height=4, dpi=200)

# ---------- Robust cleaning for SEM ----------
grp <- if ("wb_regioncode" %in% names(d2)) "wb_regioncode" else if ("region" %in% names(d2)) "region" else NA_character_
if (is.na(grp)) stop("No region variable (wb_regioncode/region) found in dataset2.dta")

need <- intersect(c(vars, structs, grp), names(d2))
d2c <- d2[, need, drop=FALSE]

# numeric & winsorize
for (v in intersect(c(vars, structs), names(d2c))) d2c[[v]] <- numfix(d2c[[v]])
for (v in intersect(c(vars, "dah_23","year"), names(d2c))) d2c[[v]] <- winsor(d2c[[v]], p=0.005)
for (v in intersect(c(vars, "dah_23","year"), names(d2c))) d2c[[v]] <- zfix(d2c[[v]])
d2c[[grp]] <- as.factor(d2c[[grp]])
d2c <- stats::na.omit(d2c)

# Drop zero-variance indicators if any
nzv <- vapply(d2c[, intersect(vars, names(d2c)), drop=FALSE],
              function(x) isTRUE(all.equal(stats::var(x, na.rm=TRUE), 0)), logical(1))
if (any(nzv)) {
  drop_vars <- names(nzv)[nzv]
  message("Dropping zero-variance indicators: ", paste(drop_vars, collapse=", "))
  vars <- setdiff(vars, drop_vars)
  d2c <- d2c[, intersect(c(vars, structs, grp), names(d2c)), drop=FALSE]
}

# ---------- Models ----------
model_base <- "
  CD  =~ hiv_dah_23 + mal_dah_23 + tb_dah_23
  NCD =~ ncd_dah_23 + rmh_dah_23 + nch_dah_23
  aid_general =~ CD + NCD
  dah_23 ~ aid_general + year
"

control_list <- list(iter.max=2000, rel.tol=1e-7)

cat("\\n=== Baseline SEM (MLR) ===\\n")
fit0 <- safe_sem(model_base, data=d2c, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                 missing="fiml", control=control_list, optim.method="nlminb")

converged <- !is.null(fit0) && lavInspect(fit0, "converged")

if (!converged) {
  cat("Baseline SEM did not converge. Trimming 0.5% Mahalanobis outliers and retrying...\\n")
  X <- as.matrix(d2c[, vars, drop=FALSE])
  mu <- colMeans(X); S <- tryCatch(stats::cov(X), error=function(e) NULL)
  if (is.null(S) || any(!is.finite(S))) S <- diag(ncol(X))
  # ridge to ensure invertible
  S <- S + diag(1e-6, ncol(S))
  md <- tryCatch(stats::mahalanobis(X, center=mu, cov=S), error=function(e) rep(0, nrow(X)))
  cutoff <- stats::quantile(md, 0.995, na.rm=TRUE)
  keep <- md <= cutoff
  d2c_trim <- d2c[keep, , drop=FALSE]
  fit0 <- safe_sem(model_base, data=d2c_trim, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                   missing="fiml", control=control_list, optim.method="nlminb")
  if (!is.null(fit0) && lavInspect(fit0, "converged")) {
    cat("Converged after trimming.\\n")
    d2c <- d2c_trim
  } else {
    cat("Still not converged. Falling back to measurement-only CFA.\\n")
    model_base <- "
      CD  =~ hiv_dah_23 + mal_dah_23 + tb_dah_23
      NCD =~ ncd_dah_23 + rmh_dah_23 + nch_dah_23
    "
    fit0 <- safe_cfa(model_base, data=d2c, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                     missing="fiml", control=control_list, optim.method="nlminb")
    if (is.null(fit0) || !lavInspect(fit0, "converged")) {
      stop("Neither SEM nor CFA converged after robust cleaning.")
    }
  }
}

print(fitMeasures(fit0, c("cfi.robust","rmsea.robust","cfi","rmsea","chisq","df")))

# ---------- MI-guided residual correlations among observed items ----------
mi <- tryCatch(modindices(fit0, sort.=TRUE), error=function(e) NULL)
chosen <- character(0)
if (!is.null(mi) && nrow(mi)) {
  mi_items <- subset(mi, op=="~~" & lhs %in% vars & rhs %in% vars & lhs != rhs)
  if (nrow(mi_items)) {
    # get unique unordered pairs
    mi_items$key <- ifelse(mi_items$lhs < mi_items$rhs,
                           paste(mi_items$lhs, mi_items$rhs, sep="|"),
                           paste(mi_items$rhs, mi_items$lhs, sep="|"))
    mi_unique <- mi_items[!duplicated(mi_items$key), ]
    mi_top <- head(mi_unique[order(-mi_unique$mi), c("lhs","op","rhs","mi")], 5)
    chosen <- apply(mi_top, 1, function(r) sprintf("%s %s %s", r["lhs"], r["op"], r["rhs"]))
  }
}
if (length(chosen)) {
  cat("\\nAdded residuals:\\n"); print(chosen)
  model_mod <- paste(model_base, paste(chosen, collapse="\\n"), sep="\\n")
} else {
  cat("\\nNo residuals added.\\n")
  model_mod <- model_base
}

fit1 <- safe_sem(model_mod, data=d2c, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                 missing="fiml", control=control_list, optim.method="nlminb")
cat("\\nFit after MI residuals (or same as baseline if none):\\n")
if (!is.null(fit1) && lavInspect(fit1, "converged")) {
  print(fitMeasures(fit1, c("cfi.robust","rmsea.robust","cfi","rmsea","chisq","df")))
} else {
  cat("Modified model did not converge; keeping previous fit.\\n")
  fit1 <- fit0
}

# Plot: Top MIs
if (!is.null(mi) && nrow(mi)) {
  mi_plot <- head(mi[order(-mi$mi), ], 10)
  if (nrow(mi_plot) > 0) {
    p_mi <- ggplot(mi_plot, aes(x=reorder(paste(lhs, op, rhs), mi), y=mi)) +
      geom_col() + coord_flip() + theme_minimal() +
      labs(x=NULL, y="MI", title="Top Modification Indices")
    ggsave("/content/fig_top_MIs.png", p_mi, width=6, height=4, dpi=200)
  }
}

# ---------- Multi-group invariance (MLR) ----------
model_meas <- "
  CD  =~ hiv_dah_23 + mal_dah_23 + tb_dah_23
  NCD =~ ncd_dah_23 + rmh_dah_23 + nch_dah_23
"
cat("\\n=== Multi-group invariance (configural/metric/scalar, MLR) ===\\n")
fit_cfg <- safe_cfa(model_meas, data=d2c, group=grp, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                    missing="fiml", control=control_list, optim.method="nlminb")
fit_met <- safe_cfa(model_meas, data=d2c, group=grp, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                    missing="fiml", control=control_list, optim.method="nlminb", group.equal="loadings")
fit_sca <- safe_cfa(model_meas, data=d2c, group=grp, estimator="MLR", std.lv=TRUE, meanstructure=TRUE,
                    missing="fiml", control=control_list, optim.method="nlminb", group.equal=c("loadings","intercepts"))

get_meas <- function(f) if (is.null(f) || !lavInspect(f, "converged")) rep(NA_real_,4) else fitMeasures(f, c("cfi.robust","rmsea.robust","chisq","df"))
cfg_m <- get_meas(fit_cfg); met_m <- get_meas(fit_met); sca_m <- get_meas(fit_sca)

tab <- data.frame(
  model = c("configural","metric","scalar"),
  cfi.robust   = c(cfg_m[1], met_m[1], sca_m[1]),
  rmsea.robust = c(cfg_m[2], met_m[2], sca_m[2]),
  chisq        = c(cfg_m[3], met_m[3], sca_m[3]),
  df           = c(cfg_m[4], met_m[4], sca_m[4])
)
write.csv(tab, "/content/invariance_fit_measures_MLR.csv", row.names=FALSE)
print(tab)

p_rmsea <- ggplot(tab, aes(x=model, y=rmsea.robust, group=1)) +
  geom_line() + geom_point(size=3) + theme_minimal() +
  labs(x=NULL, y="RMSEA (robust)", title="Invariance Fit (RMSEA)")
p_cfi <- ggplot(tab, aes(x=model, y=cfi.robust, group=1)) +
  geom_line() + geom_point(size=3) + theme_minimal() +
  labs(x=NULL, y="CFI (robust)", title="Invariance Fit (CFI)")
ggsave("/content/fig_fit_RMSEA.png", p_rmsea, width=6, height=4, dpi=200)
ggsave("/content/fig_fit_CFI.png", p_cfi, width=6, height=4, dpi=200)

cat("\\nSaved in /content/:\\n",
    " - fig_loadings_forest.png\\n",
    " - fig_top_MIs.png (if MI available)\\n",
    " - fig_fit_RMSEA.png\\n",
    " - fig_fit_CFI.png\\n",
    " - invariance_fit_measures_MLR.csv\\n")