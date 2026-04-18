# ============================================================================
# TruthCert GLMM External Cross-check Script (metafor rma.glmm)
# Generated automatically by TruthCert (add-only upgrade)
# Generated at: 2026-02-26T19:17:55.203Z
# ============================================================================

if (!requireNamespace("metafor", quietly = TRUE)) {
  install.packages("metafor", repos = "https://cloud.r-project.org")
}
library(metafor)

dat <- data.frame(
  study = c("Aronson 1948", "Ferguson 1949", "Rosenthal 1960", "Hart 1977", "Frimodt-Moller 1973", "Comstock 1974"),
  ai = c(4, 6, 3, 62, 33, 180),
  bi = c(119, 300, 228, 13536, 5036, 16733),
  ci = c(11, 29, 11, 248, 47, 372),
  di = c(128, 274, 209, 12619, 5761, 17482)
)

families <- c("UM.FS", "UM.RS", "CM.EL", "CM.AL")
measures <- c("OR")
method_um <- "ML"
nAGQ_um <- 13

# In-app selected controls for provenance
truthcert_selected_family <- "UM.RS"
truthcert_selected_measure <- "OR"

run_glmm <- function(model, measure) {
  args <- list(ai = dat$ai, bi = dat$bi, ci = dat$ci, di = dat$di, measure = measure, model = model, slab = dat$study)
  if (startsWith(model, "UM")) {
    args$method <- method_um
    args$nAGQ <- nAGQ_um
  }
  fit <- tryCatch(do.call(metafor::rma.glmm, args), error = function(e) e)
  if (inherits(fit, "error")) {
    return(data.frame(
      model = model,
      measure = measure,
      k = nrow(dat),
      estimate_log = NA_real_,
      estimate_exp = NA_real_,
      se = NA_real_,
      ci_lb = NA_real_,
      ci_ub = NA_real_,
      tau2 = NA_real_,
      QE = NA_real_,
      QEp = NA_real_,
      error = conditionMessage(fit),
      stringsAsFactors = FALSE
    ))
  }

  est <- as.numeric(fit$b[1])
  se <- as.numeric(fit$se[1])
  ci_lb <- as.numeric(fit$ci.lb[1])
  ci_ub <- as.numeric(fit$ci.ub[1])

  data.frame(
    model = model,
    measure = measure,
    k = as.integer(fit$k),
    estimate_log = est,
    estimate_exp = exp(est),
    se = se,
    ci_lb = exp(ci_lb),
    ci_ub = exp(ci_ub),
    tau2 = if (!is.null(fit$tau2)) as.numeric(fit$tau2) else NA_real_,
    QE = if (!is.null(fit$QE)) as.numeric(fit$QE) else NA_real_,
    QEp = if (!is.null(fit$QEp)) as.numeric(fit$QEp) else NA_real_,
    error = NA_character_,
    stringsAsFactors = FALSE
  )
}

all_results <- do.call(
  rbind,
  lapply(families, function(fm) do.call(rbind, lapply(measures, function(ms) run_glmm(fm, ms))))
)

cat("\n==================== METAFOR GLMM CROSS-CHECK ====================\n")
print(all_results)

truthcert_in_app <- data.frame(
  model = c("UM.FS", "UM.RS", "CM.EL", "CM.AL"),
  in_app_estimate_exp = c(0.4209012314700695, 0.5127855847125209, 0.4295516980513469, 0.4073764436200773),
  stringsAsFactors = FALSE
)

comparison <- merge(all_results, truthcert_in_app, by = "model", all.x = TRUE, all.y = TRUE)
comparison$abs_diff <- abs(comparison$estimate_exp - comparison$in_app_estimate_exp)
comparison$rel_diff_pct <- ifelse(is.finite(comparison$in_app_estimate_exp) & comparison$in_app_estimate_exp != 0,
                                  100 * comparison$abs_diff / abs(comparison$in_app_estimate_exp), NA_real_)

cat("\n==================== APP vs METAFOR COMPARISON ===================\n")
print(comparison)

timestamp <- format(Sys.time(), "%Y%m%d_%H%M%S")
csv_file <- paste0("truthcert_glmm_metafor_crosscheck_", timestamp, ".csv")
cmp_file <- paste0("truthcert_glmm_metafor_comparison_", timestamp, ".csv")
write.csv(all_results, csv_file, row.names = FALSE)
write.csv(comparison, cmp_file, row.names = FALSE)

cat("\nWrote:\n")
cat(" - ", csv_file, "\n", sep = "")
cat(" - ", cmp_file, "\n", sep = "")

if (requireNamespace("jsonlite", quietly = TRUE)) {
  json_file <- paste0("truthcert_glmm_metafor_crosscheck_", timestamp, ".json")
  jsonlite::write_json(all_results, json_file, pretty = TRUE, auto_unbox = TRUE)
  cat(" - ", json_file, "\n", sep = "")
} else {
  cat("\nOptional package jsonlite not installed; JSON export skipped.\n")
}

cat("\nDone.\n")
