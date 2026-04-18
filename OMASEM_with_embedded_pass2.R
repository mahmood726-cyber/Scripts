csv_text <- paste0(
'study_id,first_author,year,journal,doi,country,multicenter,design,population,analysis_population,centers_n,arm_id,arm_label,group_type,drug_class,drug_name,dose_regimen,background_statin_intensity,combo_ezetimibe,pcsk9_used,cetp_used,other_therapy,n_ivus_arm,n_itt_arm,followup_weeks_ivus,followup_weeks_events,baseline_ldl_mgdl_mean,baseline_ldl_mgdl_sd,baseline_pav_pct_mean,baseline_pav_pct_sd,baseline_tav_mm3_mean,baseline_tav_mm3_sd,followup_ldl_mgdl_mean,followup_ldl_mgdl_sd,delta_ldl_mgdl_mean,delta_ldl_mgdl_sd,delta_pav_pct_mean,delta_pav_pct_sd,delta_tav_mm3_mean,delta_tav_mm3_sd,mace_definition_text,mace_components_codes,mace_window_weeks,mace_events_arm,mace_total_arm,hr_mace,hr_ci_low,hr_ci_high,log_hr_mace,se_log_hr_mace,or_mace,or_ci_low,or_ci_high,log_or_mace,se_log_or_mace,r_dldl_dpav,r_dpav_mace,r_dldl_mace,n_for_r,r_source,r_derivation_method,beta_dldl_to_dpav,se_beta_dldl_to_dpav,log_or_per1pct_dpav,se_log_or_per1pct_dpav,log_hr_per1pct_dpav,se_log_hr_per1pct_dpav,ivus_modality,ivus_catheter_mhz,pullback_speed_mm_s,segment_length_mm,corelab,mean_age,percent_female,diabetes_pct,hypertension_pct,current_smoker_pct,baseline_lvef_mean,baseline_hscrp_mgL,baseline_apob_mgdl,mace_type,analysis_set,rob2_overall,rob2_randomization,rob2_deviations,rob2_missing,rob2_measurement,rob2_reporting,source_primary_pdf,source_supp_table,page_refs,extraction_notes,verified_by,verified_on_date\nNissen 2004,Nissen,2004,,,,,,,IVUS-evaluable,,Nissen 2004_R,Pravastatin 40 mg (reference),R,,,,,,,,,327,,18,18,150.2,,39.5,,,,110.4,,-39.79999999999998,,1.9,4.9,,,,,18,9,327,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNissen 2004,Nissen,2004,,,,,,,IVUS-evaluable,,Nissen 2004_I,Atorvastatin 80 mg (intensive),I,,,,,,,,,327,,18,18,150.2,,38.4,,,,78.9,,-71.29999999999998,,0.6,5.1,,,,,18,6,327,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNissen 2006,Nissen,2006,,,,,,,IVUS-evaluable,,Nissen 2006_I,Rosuvastatin 40 mg (intensive),I,,,,,,,,,507,,24,24,130.4,,39.6,,,,60.8,,-69.60000000000001,,-0.98,3.2,,,,,24,17,507,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNissen 2007,Nissen,2007,,,,,,,IVUS-evaluable,,Nissen 2007_R,Atorvastatin (reference),R,,,,,,,,,597,,104,104,84.3,,37.1,,,,87.2,,2.9000000000000057,,0.19,2.8,,,,,104,64,597,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNissen 2007,Nissen,2007,,,,,,,IVUS-evaluable,,Nissen 2007_I,Atorvastatin + Torcetrapib (intensive),I,,,,,,,,,591,,104,104,83.1,,37.0,,,,70.1,,-13.0,,0.12,3.0,,,,,104,72,591,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nTsujita 2015,Tsujita,2015,,,,,,,IVUS-evaluable,,Tsujita 2015_I,Atorvastatin + ezetimibe 10 mg (intensive),I,,,,,,,,,122,,44,44,109.8,,51.3,,,,63.2,,-46.599999999999994,,-1.4,4.7,,,,,44,2,122,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nTsujita 2015,Tsujita,2015,,,,,,,IVUS-evaluable,,Tsujita 2015_R,Atorvastatin (reference),R,,,,,,,,,124,,44,44,108.3,,50.9,,,,73.3,,-35.0,,-0.3,5.1,,,,,44,1,124,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNicholls 2016,Nicholls,2016,,,,,,,IVUS-evaluable,,Nicholls 2016_I,Evolocumab 420 mg monthly (intensive),I,,,,,,,,,484,,78,78,92.6,,36.9,,,,36.6,,-55.99999999999999,,-0.95,3.9,,,,,78,18,484,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNicholls 2016,Nicholls,2016,,,,,,,IVUS-evaluable,,Nicholls 2016_R,Placebo (reference),R,,,,,,,,,484,,78,78,93.0,,37.2,,,,87.8,,-5.200000000000003,,0.05,3.8,,,,,78,25,484,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nRaber 2022,Raber,2022,,,,,,,IVUS-evaluable,,Raber 2022_I,Alirocumab 150 mg q2w (intensive),I,,,,,,,,,148,,52,52,154.8,,40.9,,,,23.6,,-131.20000000000002,,-2.13,2.3,,,,,52,4,148,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nRaber 2022,Raber,2022,,,,,,,IVUS-evaluable,,Raber 2022_R,Placebo (reference),R,,,,,,,,,152,,52,52,150.9,,43.0,,,,74.4,,-76.5,,-0.92,2.1,,,,,52,5,152,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nSchartl 2001,Schartl,2001,,,,,,,IVUS-evaluable,,Schartl 2001_I,Atorvastatin  (intensive),I,,,,,,,,,65,,52,52,155.0,,44.5,,,,86.0,,-69.0,,0.14,5.1,,,,,52,2,65,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nSchartl 2001,Schartl,2001,,,,,,,IVUS-evaluable,,Schartl 2001_R,Usual care (reference),R,,,,,,,,,66,,52,52,166.0,,41.9,,,,140.0,,-26.0,,0.37,4.9,,,,,52,5,66,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nOkazaki 2004,Okazaki,2004,,,,,,,IVUS-evaluable,,Okazaki 2004_I,Atorvastatin 20 mg (intensive),I,,,,,,,,,35,,24,24,124.6,,42.6,,,,70.0,,-54.599999999999994,,-4.66,6.9,,,,,24,0,35,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nOkazaki 2004,Okazaki,2004,,,,,,,IVUS-evaluable,,Okazaki 2004_R,Usual care (reference),R,,,,,,,,,35,,24,24,123.9,,42.6,,,,119.4,,-4.5,,3.07,6.2,,,,,24,1,35,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nHiro 2009,Hiro,2009,,,,,,,IVUS-evaluable,,Hiro 2009_R,Pitavastatin 4 mg (reference),R,,,,,,,,,147,,42,42,130.9,,49.7,,,,81.1,,-49.80000000000001,,-5.01,4.9,,,,,42,0,147,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nHiro 2009,Hiro,2009,,,,,,,IVUS-evaluable,,Hiro 2009_I,Atorvastatin 20 mg (intensive),I,,,,,,,,,149,,42,42,133.8,,50.8,,,,84.1,,-49.70000000000002,,-5.48,4.7,,,,,42,3,149,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNasu 2009,Nasu,2009,,,,,,,IVUS-evaluable,,Nasu 2009_I,Fluvastatin 60 mg (intensive),I,,,,,,,,,40,,12,12,144.9,,54.1,,,,98.1,,-46.80000000000001,,-2.05,2.9,,,,,12,0,40,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNasu 2009,Nasu,2009,,,,,,,IVUS-evaluable,,Nasu 2009_R,Control (reference),R,,,,,,,,,39,,12,12,122.3,,48.7,,,,121.0,,-1.2999999999999972,,0.98,5.1,,,,,12,1,39,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nTakayama 2009,Takayama,2009,,,,,,,IVUS-evaluable,,Takayama 2009_I,Rosuvastatin (intensive),I,,,,,,,,,126,,76,76,140.2,,47.8,,,,82.9,,-57.29999999999998,,-2.89,4.4,,,,,76,0,126,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from ',
'Pass-1 (eTable 1 values only),MA,2025-08-12\nNozue 2012,Nozue,2012,,,,,,,IVUS-evaluable,,Nozue 2012_I,Pitavastatin 4 mg (intensive),I,,,,,,,,,77,,32,32,126.0,,55.2,,,,74.0,,-52.0,,-0.2,3.4,,,,,32,2,77,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNozue 2012,Nozue,2012,,,,,,,IVUS-evaluable,,Nozue 2012_R,Pravastatin 20 mg (reference),R,,,,,,,,,77,,32,32,137.0,,53.9,,,,95.0,,-42.0,,0.2,4.8,,,,,32,0,77,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nLee 2012,Lee,2012,,,,,,,IVUS-evaluable,,Lee 2012_R,Atorvastatin 10 mg (reference),R,,,,,,,,,19,,24,24,122.4,,49.9,,,,68.5,,-53.900000000000006,,0.38,4.1,,,,,24,1,19,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nLee 2012,Lee,2012,,,,,,,IVUS-evaluable,,Lee 2012_I,Atorvastatin 40 mg (intensive),I,,,,,,,,,20,,24,24,112.4,,51.6,,,,52.1,,-60.300000000000004,,-1.5,3.9,,,,,24,0,20,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nMasuda 2015,Masuda,2015,,,,,,,IVUS-evaluable,,Masuda 2015_R,Rosuvastatin 5 mg (reference),R,,,,,,,,,24,,24,24,123.0,,46.4,,,,75.1,,-47.900000000000006,,-0.6,5.5,,,,,24,0,24,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nMasuda 2015,Masuda,2015,,,,,,,IVUS-evaluable,,Masuda 2015_I,Rosuvastatin 5 mg + ezetimibe 10 mg (intensive),I,,,,,,,,,26,,24,24,131.8,,52.5,,,,57.3,,-74.50000000000001,,-5.6,5.5,,,,,24,0,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nMatsushita 2016,Matsushita,2016,,,,,,,IVUS-evaluable,,Matsushita 2016_I,Rosuvastatin 20 mg (intensive),I,,,,,,,,,25,,52,52,136.7,,43.6,,,,54.1,,-82.6,,-2.26,3.6,,,,,52,0,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nMatsushita 2016,Matsushita,2016,,,,,,,IVUS-evaluable,,Matsushita 2016_R,Rosuvastatin 10 mg (reference),R,,,,,,,,,25,,52,52,139.5,,42.3,,,,80.5,,-59.0,,-1.06,3.3,,,,,52,0,25,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nMatsushita 2016,Matsushita,2016,,,,,,,IVUS-evaluable,,Matsushita 2016_R,Pitavastatin 4 mg (reference),R,,,,,,,,,26,,52,52,142.2,,42.3,,,,77.7,,-64.49999999999999,,-0.36,3.7,,,,,52,0,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nMatsushita 2016,Matsushita,2016,,,,,,,IVUS-evaluable,,Matsushita 2016_R,Atorvastatin 10 mg (reference),R,,,,,,,,,26,,52,52,142.8,,46.2,,,,85.9,,-56.900000000000006,,0.63,4.6,,,,,52,0,26,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nWatanabe 2017,Watanabe,2017,,,,,,,IVUS-evaluable,,Watanabe 2017_I,Atorvastatin + Ezetimibe (intensive),I,,,,,,,,,150,,52,52,100.8,,43.0,,,,65.4,,-35.39999999999999,,-0.78,3.3,,,,,52,6,150,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nWatanabe 2017,Watanabe,2017,,,,,,,IVUS-evaluable,,Watanabe 2017_R,Pitavastatin 4 mg (reference),R,,,,,,,,,153,,52,52,101.1,,42.8,,,,72.8,,-28.299999999999997,,-0.29,3.3,,,,,52,5,153,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nHibi 2018,Hibi,2018,,,,,,,IVUS-evaluable,,Hibi 2018_I,Rosuvastatin 20 mg (intensive),I,,,,,,,,,102,,104,104,89.1,,37.5,,,,64.1,,-25.0,,-2.13,6.7,,,,,104,3,102,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nHibi 2018,Hibi,2018,,,,,,,IVUS-evaluable,,Hibi 2018_R,Atorvastatin 20 mg (reference),R,,,,,,,,,101,,104,104,85.7,,38.6,,,,72.7,,-13.0,,-1.06,7.1,,,,,104,2,101,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNicholls 2018,Nicholls,2018,,,,,,,IVUS-evaluable,,Nicholls 2018_I,CER-001 + statin (intensive),I,,,,,,,,,147,,54,54,84.9,,39.1,,,,72.9,,-12.0,,-0.09,6.9,,,,,54,2,147,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNicholls 2018,Nicholls,2018,,,,,,,IVUS-evaluable,,Nicholls 2018_R,Placebo + statin (reference),R,,,,,,,,,146,,54,54,88.8,,38.8,,,,80.9,,-7.8999999999999915,,0.12,6.8,,,,,54,2,146,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nAko 2019,Ako,2019,,,,,,,IVUS-evaluable,,Ako 2019_I,Alirocumab 75/150 mg q2w (intensive),I,,,,,,,,,104,,36,36,97.9,,44.4,,,,34.7,,-63.2,,-1.4,3.9,,,,,36,4,104,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nAko 2019,Ako,2019,,,,,,,IVUS-evaluable,,Ako 2019_R,Statin low-dose (reference),R,,,,,,,,,102,,36,36,95.7,,44.0,,,,80.2,,-15.5,,-1.3,3.8,,,,,36,4,102,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nOh 2021,Oh,2021,,,,,,,IVUS-evaluable,,Oh 2021_R,Atorvastatin 10 mg + ezetimibe 10 mg (reference),R,,,,,,,,,20,,52,52,107.0,,45.9,,,,60.5,,-46.5,,-2.9,6.1,,,,,52,0,20,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nOh 2021,Oh,2021,,,,,,,IVUS-evaluable,,Oh 2021_I,Atorvastatin 40 mg (intensive),I,,,,,,,,,21,,52,52,100.6,,44.8,,,,57.8,,-42.8,,-3.2,5.0,,,,,52,0,21,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNicholls 2022,Nicholls,2022,,,,,,,IVUS-evaluable,,Nicholls 2022_I,Evolocumab 420 mg monthly (intensive),I,,,,,,,,,80,,52,52,140.4,,45.8,,,,28.1,,-112.30000000000001,,-2.29,3.0,,,,,52,0,80,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\nNicholls 2022,Nicholls,2022,,,,,,,IVUS-evaluable,,Nicholls 2022_R,Placebo (reference),R,,,,,,,,,81,,52,52,142.1,,45.1,,,,87.2,,-54.89999999999999,,-0.61,2.9,,,,,52,4,81,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,trial_defined,complete_link,,,,,,,,JAMA Cardiol 2023 eTable 1,,Reconstructed from Pass-1 (eTable 1 values only),MA,2025-08-12\n'
)
csv_text <- gsub("\\n", "\n", csv_text)

# ==============================================
# Fully self-contained ΔPAV ~ ΔLDL + OMASEM scaffold
# (embeds pass-2 master CSV; no external files required)
# ==============================================

# ---- Packages
req <- c('dplyr','tidyr','metafor','metaSEM','readr')
need <- req[!sapply(req, requireNamespace, quietly=TRUE)]
if(length(need)) install.packages(need, repos='https://cloud.r-project.org')
invisible(lapply(req, library, character.only=TRUE))

# ---- Load embedded CSV
d <- read.csv(textConnection(csv_text), stringsAsFactors = FALSE, check.names = FALSE)

# ---- Normalize names
norm_names <- function(x) {
  x <- as.character(x)
  x <- gsub("\u00A0", " ", x, fixed = TRUE)
  x <- gsub("[\t\r\n]+", " ", x)
  x <- trimws(x)
  x <- tolower(gsub("[^A-Za-z0-9]+", "_", x))
  x <- gsub("_+", "_", x)
  x <- gsub("^_|_$", "", x)
  x
}
names(d) <- norm_names(names(d))

# ---- Candidate mapping
pick <- function(cands) { hits <- intersect(cands, names(d)); if (length(hits)) hits[1] else NA_character_ }
cand <- list(
  study_id            = c('study_id','study','trial','trial_id','studyname','study_name'),
  arm_label           = c('arm_label','arm','treatment','tx','intervention','group_label','armname'),
  group_type          = c('group_type','arm_type','group','armgroup','intensity','grp'),
  n_ivus_arm          = c('n_ivus_arm','n_ivus','ivus_n','n','sample_size','n_arm'),
  delta_ldl_mgdl_mean = c('delta_ldl_mgdl_mean','delta_ldl','dldl','change_ldl','ldl_change_mgdl','delta_ldl_mean','ldl_delta'),
  delta_pav_pct_mean  = c('delta_pav_pct_mean','delta_pav','dpav','change_pav','pav_change_pct','delta_pav_mean','pav_delta'),
  delta_pav_pct_sd    = c('delta_pav_pct_sd','sd_delta_pav','delta_pav_sd','dpav_sd','pav_sd')
)
map <- vapply(cand, pick, character(1))
needed <- c('study_id','arm_label','n_ivus_arm','delta_ldl_mgdl_mean','delta_pav_pct_mean','delta_pav_pct_sd')

if (is.na(map['group_type'])) {
  map['group_type'] <- '.__derived_group_type__'
  gl <- tolower(as.character(d[[ map['arm_label'] ]]))
  is_ref <- grepl('(reference|control|placebo|usual care|standard)', gl, ignore.case = TRUE)
  is_int <- grepl('(intensive|ezetimibe|pcsk9|evolo|aliroc|inclis|high)', gl, ignore.case = TRUE) | grepl('+', gl, fixed = TRUE)
  d$.__derived_group_type__ <- ifelse(is_ref, 'R', ifelse(is_int, 'I', NA))
}

missing_now <- setdiff(needed, names(map)[!is.na(map)])
if (length(missing_now)) {
  cat('\nERROR: Missing required columns even after auto-detection:\n  ',
      paste(missing_now, collapse=', '),
      '\nDetected columns in your CSV:\n  ', paste(names(d), collapse=', '), '\n', sep='')
  stop('Please tell me which CSV columns map to the missing fields.')
}

col_or_empty <- function(df, nm) if (is.na(nm)) NULL else df[[nm]]
dat <- data.frame(
  study_id            = col_or_empty(d, map['study_id']),
  arm_label           = col_or_empty(d, map['arm_label']),
  group_type          = col_or_empty(d, map['group_type']),
  n_ivus_arm          = col_or_empty(d, map['n_ivus_arm']),
  delta_ldl_mgdl_mean = col_or_empty(d, map['delta_ldl_mgdl_mean']),
  delta_pav_pct_mean  = col_or_empty(d, map['delta_pav_pct_mean']),
  delta_pav_pct_sd    = col_or_empty(d, map['delta_pav_pct_sd']),
  stringsAsFactors = FALSE
)

for (cc in c('n_ivus_arm','delta_ldl_mgdl_mean','delta_pav_pct_mean','delta_pav_pct_sd')) dat[[cc]] <- suppressWarnings(as.numeric(dat[[cc]]))

cat('\nColumn mapping used:\n'); for (nm in names(map)) cat(sprintf('  %-22s <- %s\n', nm, map[[nm]])); cat('\n')

library(dplyr); library(tidyr)
if (nrow(dat) == 0) stop('Dataset has 0 rows after loading.')

pair <- dat %>%
  mutate(arm = ifelse(group_type=='I','I', ifelse(group_type=='R','R', NA))) %>%
  tidyr::pivot_wider(
    names_from = arm,
    values_from = c(n_ivus_arm, delta_ldl_mgdl_mean, delta_pav_pct_mean, delta_pav_pct_sd)
  ) %>%
  filter(
    !is.na(delta_pav_pct_mean_I), !is.na(delta_pav_pct_mean_R),
    !is.na(delta_pav_pct_sd_I),  !is.na(delta_pav_pct_sd_R),
    !is.na(n_ivus_arm_I),        !is.na(n_ivus_arm_R)
  ) %>%
  mutate(
    dLDL   = delta_ldl_mgdl_mean_I - delta_ldl_mgdl_mean_R,
    dPAV   = delta_pav_pct_mean_I  - delta_pav_pct_mean_R,
    se_dPAV = sqrt((delta_pav_pct_sd_I^2/n_ivus_arm_I) + (delta_pav_pct_sd_R^2/n_ivus_arm_R)),
    vi      = se_dPAV^2
  )

if (nrow(pair) == 0) {
  cat('\nNo analyzable study pairs found (need both arms with ΔPAV mean, SD, and n).\n')
} else {
  cat('\n=== Random-effects meta-regression: ΔPAV ~ ΔLDL ===\n')
  res <- metafor::rma(yi = dPAV, vi = vi, mods = ~ dLDL, data = pair, method = 'REML')
  print(res)
  ci <- confint(res)
  summ <- data.frame(
    metric = c('k (pairs)','tau2','RE slope (ΔPAV ~ ΔLDL)','95% CI low','95% CI high','p-value'),
    value  = c(nrow(pair), res$tau2, coef(res)['dLDL'], ci$random['dLDL','ci.lb'], ci$random['dLDL','ci.ub'], res$pval)
  )
  write.csv(summ, 'DeltaPAV_on_DeltaLDL_RE_summary_from_embedded.csv', row.names = FALSE)
  cat('Wrote: DeltaPAV_on_DeltaLDL_RE_summary_from_embedded.csv\n')
}

# ---- OMASEM scaffold (skipped unless correlations provided)
library(metaSEM)
studies <- dat %>%
  group_by(study_id) %>%
  summarise(N = sum(n_ivus_arm, na.rm=TRUE), .groups='drop') %>%
  mutate(r12 = NA_real_, r23 = NA_real_, r13 = NA_real_)
cors <- lapply(seq_len(nrow(studies)), function(i) { R <- diag(3); colnames(R) <- rownames(R) <- c('dLDL','dPAV','MACE'); R })
Ns <- as.numeric(studies$N); names(Ns) <- studies$study_id
cat('\n[OMASEM note] Provide study-level correlations r12/r23/r13 to run Stage 1/2.\n')
