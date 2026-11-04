# Experiment X2: a cost of leaving away from the wanted time

Synthetic data (simulator), 30 paired seeds. Sweeps and readings: `experiments/configs/x2.yaml`.
Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before these runs.

| Hypothesis | Rule | Holds |
|---|---|---|
| H2.0 | at cost 0, B0, EARLIEST and B3 write the earlier run's events, seed by seed | yes |
| H2.1 | EARLIEST - B0 falls from cost 0.0 to 0.03 (whole interval of the change below zero) and is above zero at 0.001 and below zero at 0.03 | NO |
| H2.2 | B3 - EARLIEST equivalent to zero at every cost | yes |
| H2.3 | (B0's mean gap - EARLIEST's) x 0.0031 per hour is below EARLIEST's relative gain over B0 at cost 0.0 | yes |

## H2.0: cost 0 repeats the earlier run

| Cell | Seeds identical |
|---|---|
| B0: B0[time_deviation_cost_per_hour=0.0] | 30 / 30 |
| EARLIEST: EARLIEST[time_deviation_cost_per_hour=0.0] | 30 / 30 |
| EARLIEST_B: EARLIEST[time_deviation_cost_per_hour=0.0] | 30 / 30 |
| B3: B3[time_deviation_cost_per_hour=0.0] | 30 / 30 |

## H2.1 and H2.2: completed rides per 100 searches, seed by seed

| Cost per hour | EARLIEST − B0 (95% CI) | B3 − EARLIEST (95% CI) | B3 − EARLIEST equivalence p |
|---|---|---|---|
| 0.0 | +0.318 (+0.228 to +0.407) | +0.001 (-0.018 to +0.021) | 0.0000 |
| 0.001 | +0.308 (+0.218 to +0.399) | +0.001 (-0.018 to +0.021) | 0.0000 |
| 0.002 | +0.296 (+0.205 to +0.387) | -0.001 (-0.019 to +0.018) | 0.0000 |
| 0.005 | +0.268 (+0.175 to +0.360) | -0.002 (-0.021 to +0.017) | 0.0000 |
| 0.01 | +0.209 (+0.115 to +0.304) | -0.005 (-0.025 to +0.015) | 0.0000 |
| 0.03 | +0.052 (-0.035 to +0.139) | -0.018 (-0.041 to +0.005) | 0.0000 |

Change in EARLIEST − B0 from the smallest to the largest cost: -0.266 (-0.311 to -0.220). Falls: yes. Crosses inside the range: no. The mean never drops to zero on the grid.

## H2.3: how much of the gain shorter exposure explains

EARLIEST's passengers asked for rides leaving 0.294 hours earlier than B0's (0.284 to 0.303), relative to the time each wanted. At 0.0031 per hour that predicts a relative gain of 0.0910% (0.0882% to 0.0938%); the observed gain was 1.0511%, so exposure accounts for about 9% of it.

## Means per cell

| Cost per hour | B0 | EARLIEST | B3 | Booking requests per search, B0 | EARLIEST |
|---|---|---|---|---|---|
| 0.0 | 30.22 | 30.54 | 30.54 | 0.457 | 0.461 |
| 0.001 | 30.21 | 30.52 | 30.52 | 0.457 | 0.460 |
| 0.002 | 30.20 | 30.50 | 30.50 | 0.457 | 0.460 |
| 0.005 | 30.18 | 30.45 | 30.45 | 0.456 | 0.459 |
| 0.01 | 30.14 | 30.35 | 30.34 | 0.455 | 0.458 |
| 0.03 | 29.97 | 30.02 | 30.00 | 0.452 | 0.452 |
