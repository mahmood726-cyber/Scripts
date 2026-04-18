# R Validation Script for NMA Pro v8.0 (S3 File)
# Generates reference values from R netmeta

library(netmeta)

# Dataset 1: Thrombolytics (Woods)
data(Woods2010)
nma1 <- netmeta(TE, seTE, treat1, treat2, studlab=study, data=Woods2010,
                sm="OR", reference.group="Placebo", random=TRUE)
cat("Thrombolytics: tau2 =", round(nma1$tau^2, 6),
    ", I2 =", round(nma1$I2.random*100, 1), "%\n")
print(round(netrank(nma1)$Pscore.random, 4))

# Dataset 2: Parkinson
data(Parkinson)
nma2 <- netmeta(TE, seTE, treat1, treat2, studlab=study, data=Parkinson,
                sm="MD", random=TRUE)
cat("Parkinson: tau2 =", round(nma2$tau^2, 4),
    ", I2 =", round(nma2$I2.random*100, 1), "%\n")

# Dataset 3: Diabetes (simulated Salam 2013)
diabetes <- data.frame(
  study = paste0("S", 1:12),
  treat1 = c("PBO","PBO","PBO","A","A","B","PBO","A","B","C","C","D"),
  treat2 = c("A","B","C","B","C","C","D","D","D","D","A","A"),
  TE = c(-0.5,-0.7,-0.4,-0.2,0.1,0.3,-0.6,-0.1,0.1,0.2,-0.3,-0.4),
  seTE = c(0.15,0.18,0.12,0.14,0.16,0.13,0.17,0.15,0.14,0.16,0.12,0.15)
)
nma3 <- netmeta(TE, seTE, treat1, treat2, studlab=study, data=diabetes,
                sm="MD", reference.group="PBO", random=TRUE)
cat("Diabetes: tau2 =", round(nma3$tau^2, 4),
    ", I2 =", round(nma3$I2.random*100, 1), "%\n")
