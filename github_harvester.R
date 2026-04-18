# ===========================================================================================
# GITHUB META-ANALYSIS DATA HARVESTER
# Searches GitHub for research repositories with meta-analysis datasets
# ===========================================================================================

cat("\n╔═══════════════════════════════════════════════════════════════════════╗\n")
cat("║  GitHub Meta-Analysis Dataset Harvester                              ║\n")
cat("╚═══════════════════════════════════════════════════════════════════════╝\n\n")

start_time <- Sys.time()

# ===========================================================================================
# CONFIGURATION
# ===========================================================================================

library(httr)
library(jsonlite)
library(metafor)
library(dplyr)

# GitHub API settings
GITHUB_TOKEN <- Sys.getenv("GITHUB_PAT")  # Optional, increases rate limits
MAX_REPOS <- 50
FILE_SIZE_LIMIT <- 5 * 1024 * 1024  # 5MB max per file

# Analysis settings
MIN_EFFECTS <- 5
REQUIRE_MODERATORS <- TRUE
MIN_MODERATORS <- 1

# Load existing results for deduplication
existing_fingerprints <- character()
if (file.exists("results/enhanced_unique_datasets.csv")) {
  existing <- read.csv("results/enhanced_unique_datasets.csv", stringsAsFactors = FALSE)
  existing_fingerprints <- paste(existing$k, existing$n_moderators, existing$domain, sep = "_")
  cat(sprintf("Loaded %d existing datasets for deduplication\n\n", nrow(existing)))
}

# ===========================================================================================
# HELPER FUNCTIONS
# ===========================================================================================

is_duplicate <- function(k, n_mods, domain) {
  fingerprint <- paste(k, n_mods, domain, sep = "_")
  fingerprint %in% existing_fingerprints
}

# Reuse functions from enhanced harvester
source_functions <- function() {
  as_numeric_safe <<- function(x) {
    if (is.numeric(x)) return(x)
    if (is.factor(x)) x <- as.character(x)
    suppressWarnings(xn <- as.numeric(x))
    ifelse(is.finite(xn), xn, NA_real_)
  }
  
  .get_col <<- function(dat, choices) {
    nml <- tolower(names(dat))
    for (c in tolower(choices)) {
      m <- which(nml == c)
      if (length(m)) return(names(dat)[m[1]])
    }
    NA_character_
  }
  
  guess_domain <<- function(name) {
    nm <- tolower(name)
    if (grepl("psych|cognit|social|emotion|behav", nm)) return("Psychology")
    if (grepl("medic|health|clinical|therapy|drug|disease", nm)) return("Medicine")
    if (grepl("educat|school|teach|student|learn", nm)) return("Education")
    "Other"
  }
  
  prepare_effect_sizes <<- function(dat) {
    tryCatch({
      nml <- tolower(names(dat))
      
      # yi/vi
      if (all(c("yi", "vi") %in% nml)) {
        dat$yi <- as_numeric_safe(dat[[which(nml == "yi")[1]]])
        dat$vi <- as_numeric_safe(dat[[which(nml == "vi")[1]]])
        return(list(dat = dat, type = "yi_vi"))
      }
      
      # yi + SE
      yi_col  <- .get_col(dat, c("yi", "effect", "es", "effectsize"))
      sei_col <- .get_col(dat, c("sei", "se_yi", "seyi", "se", "stderr"))
      if (!is.na(yi_col) && !is.na(sei_col)) {
        dat$yi <- as_numeric_safe(dat[[yi_col]])
        dat$vi <- as_numeric_safe(dat[[sei_col]])^2
        return(list(dat = dat, type = "yi_sei"))
      }
      
      # Correlation + N
      r_col <- .get_col(dat, c("r", "ri", "cor", "correlation"))
      n_col <- .get_col(dat, c("n", "ni", "sample_size", "samplesize"))
      if (!is.na(r_col) && !is.na(n_col)) {
        dat$yi <- as_numeric_safe(dat[[r_col]])
        nn <- as_numeric_safe(dat[[n_col]])
        dat$vi <- (1 - dat$yi^2)^2 / (nn - 1)
        dat$vi[nn <= 1 | is.na(nn)] <- NA_real_
        return(list(dat = dat, type = "correlation"))
      }
      
      # 2x2 table
      ai <- .get_col(dat, c("ai", "a", "event_trt"))
      bi <- .get_col(dat, c("bi", "b", "nonevent_trt"))
      ci <- .get_col(dat, c("ci", "c", "event_ctrl"))
      di <- .get_col(dat, c("di", "d", "nonevent_ctrl"))
      if (!any(is.na(c(ai, bi, ci, di)))) {
        es <- try(escalc("OR", 
                         ai = as_numeric_safe(dat[[ai]]),
                         bi = as_numeric_safe(dat[[bi]]),
                         ci = as_numeric_safe(dat[[ci]]),
                         di = as_numeric_safe(dat[[di]])), silent = TRUE)
        if (!inherits(es, "try-error")) {
          dat$yi <- es$yi
          dat$vi <- es$vi
          return(list(dat = dat, type = "OR"))
        }
      }
      
      # SMD
      m1 <- .get_col(dat, c("m1i", "mean1", "mean_trt"))
      m2 <- .get_col(dat, c("m2i", "mean2", "mean_ctrl"))
      sd1 <- .get_col(dat, c("sd1i", "sd1", "sd_trt"))
      sd2 <- .get_col(dat, c("sd2i", "sd2", "sd_ctrl"))
      n1 <- .get_col(dat, c("n1i", "n1", "n_trt"))
      n2 <- .get_col(dat, c("n2i", "n2", "n_ctrl"))
      
      if (!any(is.na(c(m1, m2, sd1, sd2, n1, n2)))) {
        es <- try(escalc("SMD",
                         m1i = as_numeric_safe(dat[[m1]]),
                         m2i = as_numeric_safe(dat[[m2]]),
                         sd1i = as_numeric_safe(dat[[sd1]]),
                         sd2i = as_numeric_safe(dat[[sd2]]),
                         n1i = as_numeric_safe(dat[[n1]]),
                         n2i = as_numeric_safe(dat[[n2]])), silent = TRUE)
        if (!inherits(es, "try-error")) {
          dat$yi <- es$yi
          dat$vi <- es$vi
          return(list(dat = dat, type = "SMD"))
        }
      }
      
      NULL
    }, error = function(e) NULL)
  }
  
  analyze_dataset <<- function(dat, dataset_name, source) {
    tryCatch({
      valid <- !is.na(dat$yi) & !is.na(dat$vi) & is.finite(dat$vi) & dat$vi > 0
      if (sum(valid) < MIN_EFFECTS) return(NULL)
      
      dat <- dat[valid, ]
      k <- nrow(dat)
      
      # Find moderators
      mods <- character()
      for (nm in names(dat)) {
        if (nm %in% c("yi", "vi", "weights", "sei")) next
        col <- dat[[nm]]
        nuniq <- length(unique(na.omit(col)))
        nmiss <- sum(is.na(col))
        if (nuniq >= 2 && nuniq < 0.95 * k && nmiss < 0.5 * k) {
          mods <- c(mods, nm)
        }
      }
      
      mods <- mods[1:min(length(mods), 8)]
      n_mods <- length(mods)
      
      if (REQUIRE_MODERATORS && n_mods < MIN_MODERATORS) return(NULL)
      
      domain <- guess_domain(dataset_name)
      
      # Check duplicate
      if (is_duplicate(k, n_mods, domain)) return(NULL)
      
      # Run model
      base_model <- try(rma(yi, vi, data = dat), silent = TRUE)
      if (inherits(base_model, "try-error")) return(NULL)
      
      data.frame(
        source = source,
        dataset = dataset_name,
        k = k,
        n_moderators = n_mods,
        moderator_names = paste(mods, collapse = ", "),
        mu = coef(base_model)[1],
        tau2 = if ("tau2" %in% names(base_model)) base_model$tau2 else NA,
        I2 = if (!is.null(base_model$I2)) base_model$I2 else NA,
        domain = domain,
        stringsAsFactors = FALSE
      )
    }, error = function(e) NULL)
  }
}

source_functions()

# ===========================================================================================
# GITHUB SEARCH QUERIES
# ===========================================================================================

# Targeted search queries for meta-analysis data
search_queries <- c(
  '"meta-analysis" data language:R extension:csv',
  '"effect size" data language:R extension:csv',
  '"meta-analysis" dataset language:R extension:rda',
  '"effect size" dataset language:R extension:rds',
  'metafor data language:R',
  'meta regression data language:R',
  '"systematic review" data language:R extension:csv'
)

# ===========================================================================================
# GITHUB API SEARCH
# ===========================================================================================

results <- list()
found_count <- 0

headers <- if (nchar(GITHUB_TOKEN) > 0) {
  add_headers(Authorization = paste("token", GITHUB_TOKEN))
} else {
  add_headers()
}

cat("Searching GitHub repositories...\n")
cat("This may take a while. Progress:\n\n")

for (query in search_queries) {
  cat(sprintf("Query: %s\n", substr(query, 1, 60)))
  
  # Search for code files
  url <- sprintf("https://api.github.com/search/code?q=%s&per_page=30",
                 URLencode(query))
  
  resp <- try(GET(url, headers, timeout(30)), silent = TRUE)
  if (inherits(resp, "try-error") || http_error(resp)) {
    cat("  API error, skipping\n\n")
    next
  }
  
  content_text <- try(content(resp, as = "text", encoding = "UTF-8"), silent = TRUE)
  if (inherits(content_text, "try-error")) next
  
  search_results <- try(fromJSON(content_text, simplifyVector = FALSE), silent = TRUE)
  if (inherits(search_results, "try-error") || !is.list(search_results)) next
  
  if (!"items" %in% names(search_results) || length(search_results$items) == 0) {
    cat("  No results\n\n")
    next
  }
  
  cat(sprintf("  Found %d files, processing...\n", length(search_results$items)))
  
  for (item in search_results$items) {
    # Skip if from metadat repos (already covered)
    if (grepl("metadat|cran/", item$repository$full_name, ignore.case = TRUE)) next
    
    # Get download URL
    file_url <- item$html_url
    download_url <- gsub("/blob/", "/raw/", file_url)
    
    # Try to download
    temp_file <- tempfile(fileext = paste0(".", tools::file_ext(item$name)))
    dl <- try(download.file(download_url, temp_file, mode = "wb", quiet = TRUE), silent = TRUE)
    
    if (inherits(dl, "try-error") || !file.exists(temp_file)) next
    
    # Check file size
    if (file.info(temp_file)$size > FILE_SIZE_LIMIT) {
      unlink(temp_file)
      next
    }
    
    # Try to load
    dat <- NULL
    ext <- tolower(tools::file_ext(item$name))
    
    if (ext == "csv") {
      dat <- try(read.csv(temp_file, stringsAsFactors = FALSE), silent = TRUE)
    } else if (ext == "rda" || ext == "rdata") {
      env <- new.env()
      try(load(temp_file, envir = env), silent = TRUE)
      objs <- ls(env)
      if (length(objs) > 0) {
        dat <- try(get(objs[1], env), silent = TRUE)
      }
    } else if (ext == "rds") {
      dat <- try(readRDS(temp_file), silent = TRUE)
    }
    
    unlink(temp_file)
    
    if (is.null(dat) || inherits(dat, "try-error") || !is.data.frame(dat)) next
    if (nrow(dat) < MIN_EFFECTS) next
    
    # Try to parse
    prep <- prepare_effect_sizes(dat)
    if (is.null(prep)) next
    
    # Analyze
    dataset_name <- sprintf("github_%s_%s",
                           gsub("/", "_", item$repository$full_name),
                           gsub("\\..*$", "", item$name))
    dataset_name <- gsub("[^A-Za-z0-9_]", "_", dataset_name)
    
    result <- analyze_dataset(prep$dat, dataset_name, "GitHub")
    
    if (!is.null(result)) {
      results[[length(results) + 1]] <- result
      found_count <- found_count + 1
      cat(sprintf("    ✓ %s (k=%d, mods=%d)\n", 
                  substr(item$repository$full_name, 1, 40),
                  result$k, result$n_moderators))
      
      # Stop if we've found enough
      if (found_count >= 35) break
    }
  }
  
  if (found_count >= 35) break
  
  cat("\n")
  Sys.sleep(2)  # Rate limiting
}

cat(sprintf("\n✓ Found %d NEW datasets from GitHub\n\n", found_count))

# ===========================================================================================
# SAVE RESULTS
# ===========================================================================================

if (length(results) > 0) {
  new_results <- bind_rows(results)
  
  # Combine with existing
  if (file.exists("results/enhanced_unique_datasets.csv")) {
    existing <- read.csv("results/enhanced_unique_datasets.csv", stringsAsFactors = FALSE)
    all_results <- bind_rows(existing, new_results)
    all_results <- distinct(all_results, dataset, .keep_all = TRUE)
  } else {
    all_results <- new_results
  }
  
  output_file <- "results/github_enriched_datasets.csv"
  write.csv(all_results, output_file, row.names = FALSE)
  
  cat(rep("═", 71), "\n")
  cat("                    FINAL RESULTS\n")
  cat(rep("═", 71), "\n\n")
  
  cat(sprintf("New datasets from GitHub:  %d\n", nrow(new_results)))
  cat(sprintf("Total unique datasets:     %d\n", nrow(all_results)))
  cat(sprintf("Target (100):              %s\n", 
              if(nrow(all_results) >= 100) "✓ ACHIEVED!" else sprintf("%d more needed", 100 - nrow(all_results))))
  cat(sprintf("\nSaved to: %s\n", output_file))
  
} else {
  cat("No new datasets found from GitHub.\n")
  cat("Consider:\n")
  cat("  1. Setting GITHUB_PAT environment variable for higher rate limits\n")
  cat("  2. Trying manual GitHub searches\n")
  cat("  3. Moving to OSF or other sources\n")
}

end_time <- Sys.time()
elapsed <- difftime(end_time, start_time, units = "mins")
cat(sprintf("\nCompleted in %.1f minutes\n", as.numeric(elapsed)))
