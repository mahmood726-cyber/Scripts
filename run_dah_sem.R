suppressPackageStartupMessages({
  if (!requireNamespace("lavaan", quietly=TRUE)) install.packages("lavaan", repos="https://cloud.r-project.org")
  if (!requireNamespace("semTools", quietly=TRUE)) install.packages("semTools", repos="https://cloud.r-project.org")
  if (!requireNamespace("haven", quietly=TRUE)) install.packages("haven", repos="https://cloud.r-project.org")
  if (!requireNamespace("ggplot2", quietly=TRUE)) install.packages("ggplot2", repos="https://cloud.r-project.org")
  if (!requireNamespace("psych", quietly=TRUE)) install.packages("psych", repos="https://cloud.r-project.org")
  library(lavaan); library(semTools); library(haven); library(ggplot2); library(psych)
})

options(stringsAsFactors=FALSE)

# ---- Load data
d2 <- read_dta("/content/dataset2.dta")
d3 <- tryCatch(read.csv("/content/dataset3.csv", stringsAsFactors=FALSE), error=function(e) NULL)

vars <- c("hiv_dah_23","mal_dah_23","tb_dah_23","ncd_dah_23","rmh_dah_23","nch_dah_23")
numfix <- function(x) suppressWarnings(as.numeric(gsub(",", "", as.character(x))))

# ---- EFA on CSV when available
if (!is.null(d3)) {
  for (v in vars) if (v %in% names(d3)) d3[[v]] <- numfix(d3[[v]])
  efa_df <- na.omit(d3[, vars, drop=FALSE])
} else {
  for (v in vars) if (v %in% names(d2)) d2[[v]] <- numfix(d2[[v]])
  efa_df <- na.omit(d2[, vars, drop=FALSE])
}

cat("\n=== EFA (2-factor, varimax) ===\n")
KMO_val <- tryCatch(KMO(efa_df)$MSA, error=function(e) NA_real_)
B <- tryCatch(cortest.bartlett(cor(efa_df), n=nrow(efa_df)), error=function(e) NULL)
if (is.null(B)) {
  cat(sprintf("KMO=%.3f, Bartlett: NA\n", KMO_val))
} else {
  cat(sprintf("KMO=%.3f, Bartlett: chi2=%.1f, p=%.1e\n", KMO_val, B$chisq, B$p.value))
}
efa_res <- fa(efa_df, nfactors=2, rotate="varimax")
print(efa_res$loadings)

# EFA figure
lf <- as.data.frame(unclass(efa_res$loadings)); lf$var <- rownames(lf)
p_load <- ggplot(lf, aes(x=reorder(var, MR1), y=MR1)) +
  geom_point(size=3) + coord_flip() + theme_minimal() +
  labs(x=NULL, y="Loading on Factor 1", title="EFA Loadings (Factor 1)")
ggsave("/content/fig_loadings_forest.png", p_load, width=6, height=4, dpi=200)

# ---- SEM (lavaan, MLR)
for (v in c(vars, "dah_23", "year")) if (v %in% names(d2)) d2[[v]] <- numfix(d2[[v]])
grp <- if ("wb_regioncode" %in% names(d2)) "wb_regioncode" else if ("region" %in% names(d2)) "region" else NA_character_
if (is.na(grp)) stop("No region variable (wb_regioncode/region) found in dataset2.dta")

keep_cols <- intersect(c(vars, "dah_23", "year", grp), names(d2))
d2c <- na.omit(d2[, keep_cols, drop=FALSE])
d2c[[grp]] <- as.factor(d2c[[grp]])

# Reduce extreme variance in structural covariates only
if ("year" %in% names(d2c))  d2c$year  <- as.numeric(scale(d2c$year))
if ("dah_23" %in% names(d2c)) d2c$dah_23 <- as.numeric(scale(d2c$dah_23))

model_base <- "
  CD  =~ hiv_dah_23 + mal_dah_23 + tb_dah_23
  NCD =~ ncd_dah_23 + rmh_dah_23 + nch_dah_23
  aid_general =~ CD + NCD
  dah_23 ~ aid_general + year
"

cat("\n=== Baseline SEM (MLR) ===\n")
fit0 <- lavaan(model_base, data=d2c, estimator="MLR", std.lv=TRUE, missing="fiml")
print(fitMeasures(fit0, c("cfi.robust","rmsea.robust","cfi","rmsea","chisq","df")))

# MI-guided residual correlations among observed items (top 5)
mi <- tryCatch(modindices(fit0, sort.=TRUE), error=function(e) NULL)
chosen <- character(0)
if (!is.null(mi) && nrow(mi)) {
  mi_items <- subset(mi, op=="~~" & lhs %in% vars & rhs %in% vars & lhs != rhs)
  mi_top  <- head(mi_items[order(-mi_items$mi), c("lhs","op","rhs","mi")], 5)
  if (nrow(mi_top) > 0) {
    chosen <- apply(mi_top, 1, function(r) sprintf("%s %s %s", r["lhs"], r["op"], r["rhs"]))
  }
}
if (length(chosen)) {
  cat("\nAdded residuals:\n"); print(chosen)
  model_mod <- paste(model_base, paste(chosen, collapse="\n"), sep="\n")
} else {
  cat("\nNo residuals added.\n")
  model_mod <- model_base
}

fit1 <- lavaan(model_mod, data=d2c, estimator="MLR", std.lv=TRUE, missing="fiml")
cat("\nFit after MI residuals (MLR):\n")
print(fitMeasures(fit1, c("cfi.robust","rmsea.robust","cfi","rmsea","chisq","df")))

# Save Top MI bar chart (if any)
if (!is.null(mi) && nrow(mi)) {
  mi_plot <- head(mi[order(-mi$mi), ], 10)
  if (nrow(mi_plot) > 0) {
    suppressPackageStartupMessages(if (!requireNamespace("ggplot2", quietly=TRUE)) install.packages("ggplot2", repos="https://cloud.r-project.org"))
    library(ggplot2)
    p_mi <- ggplot(mi_plot, aes(x=reorder(paste(lhs, op, rhs), mi), y=mi)) +
      geom_col() + coord_flip() + theme_minimal() +
      labs(x=NULL, y="MI", title="Top Modification Indices")
    ggsave("/content/fig_top_MIs.png", p_mi, width=6, height=4, dpi=200)
  }
}

# Optional path diagram (semPlot) — wrapped in tryCatch to avoid heavy deps blocking run
try({
  if (!requireNamespace("semPlot", quietly=TRUE)) install.packages("semPlot", repos="https://cloud.r-project.org")
  library(semPlot)
  png("/content/fig_sem_path.png", width=1200, height=900, res=150)
  semPaths(fit1, what="std", whatLabels="std", layout="tree", nCharNodes=0, residuals=FALSE,
           edge.label.cex=0.8, style="lisrel", sizeMan=6, sizeLat=8)
  dev.off()
}, silent=TRUE)

# ---- Multi-group measurement invariance (MLR)
model_meas <- "
  CD  =~ hiv_dah_23 + mal_dah_23 + tb_dah_23
  NCD =~ ncd_dah_23 + rmh_dah_23 + nch_dah_23
"
cat("\n=== Multi-group invariance (configural/metric/scalar, MLR) ===\n")
fit_cfg <- cfa(model_meas, data=d2c, group=grp, estimator="MLR", std.lv=TRUE, missing="fiml")
fit_met <- cfa(model_meas, data=d2c, group=grp, estimator="MLR", std.lv=TRUE, missing="fiml",
               group.equal="loadings")
fit_sca <- cfa(model_meas, data=d2c, group=grp, estimator="MLR", std.lv=TRUE, missing="fiml",
               group.equal=c("loadings","intercepts"))

tab <- data.frame(
  model = c("configural","metric","scalar"),
  cfi.robust = c(fitMeasures(fit_cfg,"cfi.robust"),
                 fitMeasures(fit_met,"cfi.robust"),
                 fitMeasures(fit_sca,"cfi.robust")),
  rmsea.robust = c(fitMeasures(fit_cfg,"rmsea.robust"),
                   fitMeasures(fit_met,"rmsea.robust"),
                   fitMeasures(fit_sca,"rmsea.robust")),
  chisq = c(fitMeasures(fit_cfg,"chisq"),
            fitMeasures(fit_met,"chisq"),
            fitMeasures(fit_sca,"chisq")),
  df = c(fitMeasures(fit_cfg,"df"),
         fitMeasures(fit_met,"df"),
         fitMeasures(fit_sca,"df"))
)
write.csv(tab, "/content/invariance_fit_measures_MLR.csv", row.names=FALSE)
print(tab)

# Invariance fit lines
p_rmsea <- ggplot(tab, aes(x=model, y=rmsea.robust, group=1)) +
  geom_line() + geom_point(size=3) + theme_minimal() +
  labs(x=NULL, y="RMSEA (robust)", title="Invariance Fit (RMSEA)")
p_cfi <- ggplot(tab, aes(x=model, y=cfi.robust, group=1)) +
  geom_line() + geom_point(size=3) + theme_minimal() +
  labs(x=NULL, y="CFI (robust)", title="Invariance Fit (CFI)")
ggsave("/content/fig_fit_RMSEA.png", p_rmsea, width=6, height=4, dpi=200)
ggsave("/content/fig_fit_CFI.png", p_cfi, width=6, height=4, dpi=200)

cat("\nAll done. Files in /content/:\n",
    " - fig_loadings_forest.png\n",
    " - fig_top_MIs.png (if MI available)\n",
    " - fig_fit_RMSEA.png\n",
    " - fig_fit_CFI.png\n",
    " - fig_sem_path.png (if semPlot installed)\n",
    " - invariance_fit_measures_MLR.csv\n")