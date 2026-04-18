# NMA Pro v6.2 - R Export
library(netmeta)

studies <- data.frame(
  study = c("GUSTO-1", "ASSENT-2", "INJECT", "RAPID-2", "GISSI-2", "ISIS-3", "COBALT", "STAR", "TIMI-10B", "In-TIME"),
  treat1 = c("SK", "TNK", "SK", "rPA", "SK", "SK", "Abb", "rPA", "TNK", "Lan"),
  treat2 = c("tPA", "tPA", "rPA", "tPA", "tPA", "tPA", "tPA", "SK", "tPA", "tPA"),
  event1 = c(1135, 749, 270, 58, 887, 1455, 73, 18, 23, 45),
  n1 = c(13780, 8461, 3004, 324, 10372, 13773, 1457, 376, 837, 2506),
  event2 = c(1021, 753, 285, 63, 862, 1418, 69, 29, 31, 43),
  n2 = c(13746, 8488, 2992, 325, 10396, 13746, 1470, 374, 421, 2503)
)

p1 <- pairwise(treat = list(treat1, treat2),
               event = list(event1, event2),
               n = list(n1, n2),
               data = studies,
               sm = "OR")

net <- netmeta(TE, seTE, treat1, treat2, studlab,
               data = p1, sm = "OR",
               reference.group = "Abb",
               common = FALSE, random = TRUE)

summary(net)
forest(net)
netrank(net)
