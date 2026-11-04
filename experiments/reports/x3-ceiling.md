# Experiment X3: the reconfirmation ceiling, cell by cell

Synthetic data (simulator), 30 paired seeds per cell. Cells and readings: `experiments/configs/x3.yaml`.
Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before X3 was computed. Seats are per 100
searches, on rides that departed; each cell is a policy minus the same ranking without requests.

| Hypothesis | Rule | Holds |
|---|---|---|
| H3.1 | at most 1 of 34 cells with the whole interval of ΔB above the ceiling | yes |
| H3.2 | ΔO, refills counted when they stand, has an interval reaching zero in every cell | NO |
| H3.3 | Spearman between the ceiling in completed rides and the observed effect is at least 0.8 | NO |

Breaches of the ceiling: B4[searches_per_day=120]. Cells with ΔO wholly below zero: B4 (run …004), B4-KM (run …004), B5 (run …004), B5-RANDOM (run …004), B4 (run …012), B4 (run …014), ORACLE (run …014), B4 (run …016), ORACLE (run …016), B4[early_release_probability=0.25,annoyed_cancel_probability=0.0], B4[early_release_probability=0.25,annoyed_cancel_probability=0.02], B4[early_release_probability=0.25,annoyed_cancel_probability=0.05], B4[early_release_probability=0.5,annoyed_cancel_probability=0.0], B4[early_release_probability=0.5,annoyed_cancel_probability=0.02], B4[early_release_probability=0.5,annoyed_cancel_probability=0.05], B4[early_release_probability=1.0,annoyed_cancel_probability=0.0], B4[early_release_probability=1.0,annoyed_cancel_probability=0.02], B4[early_release_probability=1.0,annoyed_cancel_probability=0.05], ORACLE[early_release_probability=1.0], B4[survival_threshold=0.6], B4[survival_threshold=0.7], B4[survival_threshold=0.8], B4[survival_threshold=0.9], B5[contacts_per_round=2], B5[contacts_per_round=4], B5[contacts_per_round=8], B4[searches_per_day=60], B4[searches_per_day=120]. Spearman: 0.622.

Exploratory, chosen after the hypotheses were judged: Spearman in seats 0.798; without the demand cells 0.727; over 27 distinct cells 0.590. The identity's exact residual (refills counted when requested) is wholly above zero in 23 cells, across zero in 10, and wholly below in: B4[searches_per_day=120].
Baseline check: B4 in 5eeb0000-0000-4000-8000-000000000003 against 7a1c0de0-0000-4000-8000-000000000004: 30 of 30 seeds identical.

| Cell | ρ | η | Twins found | ΔB observed (95% CI) | Ceiling, central | Ceiling, conservative | ΔO, refills standing (95% CI) | ΔO, refills requested | Completed rides, observed | Ceiling in rides |
|---|---|---|---|---|---|---|---|---|---|---|
| B4 (run …004) | 0.5 | 0.02 | 94.2% | +0.139 (+0.092 to +0.186) | +0.272 | +0.366 | -0.224 (-0.308 to -0.140) | +0.052 | +0.027 | +0.207 |
| B4-KM (run …004) | 0.5 | 0.02 | 86.5% | +0.162 (+0.109 to +0.215) | +0.282 | +0.539 | -0.257 (-0.332 to -0.183) | +0.056 | +0.012 | +0.214 |
| B5 (run …004) | 0.5 | 0.02 | 97.3% | +0.029 (-0.003 to +0.062) | +0.106 | +0.122 | -0.103 (-0.167 to -0.040) | +0.039 | -0.004 | +0.081 |
| B5-RANDOM (run …004) | 0.5 | 0.02 | 98.7% | +0.029 (+0.006 to +0.053) | +0.077 | +0.084 | -0.064 (-0.113 to -0.015) | +0.019 | +0.002 | +0.059 |
| ORACLE (run …003) | 0.5 | 0.02 | 98.1% | +0.223 (+0.176 to +0.270) | +0.288 | +0.288 | -0.040 (-0.088 to +0.008) | +0.071 | +0.126 | +0.219 |
| B4 (run …012) | 0.5 | 0.02 | 94.2% | +0.139 (+0.092 to +0.186) | +0.272 | +0.366 | -0.224 (-0.308 to -0.140) | +0.052 | +0.027 | +0.207 |
| ORACLE (run …012) | 0.5 | 0.02 | 98.1% | +0.223 (+0.176 to +0.270) | +0.288 | +0.288 | -0.040 (-0.088 to +0.008) | +0.071 | +0.126 | +0.219 |
| B4 (run …014) | 0.5 | 0.02 | 93.9% | +0.189 (+0.140 to +0.239) | +0.329 | +0.425 | -0.253 (-0.333 to -0.173) | +0.072 | +0.050 | +0.250 |
| ORACLE (run …014) | 0.5 | 0.02 | 96.0% | +0.362 (+0.314 to +0.410) | +0.364 | +0.365 | -0.131 (-0.193 to -0.069) | +0.011 | +0.206 | +0.278 |
| B4 (run …016) | 0.5 | 0.02 | 94.0% | +0.257 (+0.194 to +0.320) | +0.392 | +0.494 | -0.218 (-0.276 to -0.160) | +0.087 | +0.074 | +0.300 |
| ORACLE (run …016) | 0.5 | 0.02 | 95.3% | +0.477 (+0.424 to +0.530) | +0.518 | +0.519 | -0.160 (-0.223 to -0.098) | +0.053 | +0.251 | +0.397 |
| B4[early_release_probability=0.25,annoyed_cancel_probability=0.0] | 0.25 | 0 | 97.4% | +0.092 (+0.059 to +0.125) | +0.141 | +0.162 | -0.109 (-0.164 to -0.054) | +0.008 | +0.041 | +0.107 |
| B4[early_release_probability=0.25,annoyed_cancel_probability=0.02] | 0.25 | 0.02 | 97.0% | +0.042 (+0.004 to +0.080) | +0.130 | +0.154 | -0.136 (-0.196 to -0.077) | +0.045 | +0.002 | +0.098 |
| B4[early_release_probability=0.25,annoyed_cancel_probability=0.05] | 0.25 | 0.05 | 96.4% | -0.020 (-0.068 to +0.027) | +0.113 | +0.142 | -0.182 (-0.247 to -0.117) | +0.099 | -0.054 | +0.086 |
| B4[early_release_probability=0.5,annoyed_cancel_probability=0.0] | 0.5 | 0 | 94.6% | +0.191 (+0.148 to +0.234) | +0.283 | +0.370 | -0.195 (-0.278 to -0.112) | +0.013 | +0.065 | +0.215 |
| B4[early_release_probability=0.5,annoyed_cancel_probability=0.02] | 0.5 | 0.02 | 94.2% | +0.139 (+0.092 to +0.186) | +0.272 | +0.366 | -0.224 (-0.308 to -0.140) | +0.052 | +0.027 | +0.207 |
| B4[early_release_probability=0.5,annoyed_cancel_probability=0.05] | 0.5 | 0.05 | 93.6% | +0.083 (+0.033 to +0.134) | +0.256 | +0.361 | -0.281 (-0.368 to -0.193) | +0.099 | -0.024 | +0.194 |
| B4[early_release_probability=1.0,annoyed_cancel_probability=0.0] | 1 | 0 | 89.4% | +0.383 (+0.324 to +0.443) | +0.576 | +0.926 | -0.386 (-0.505 to -0.268) | +0.003 | +0.100 | +0.438 |
| B4[early_release_probability=1.0,annoyed_cancel_probability=0.02] | 1 | 0.02 | 89.1% | +0.327 (+0.264 to +0.389) | +0.566 | +0.927 | -0.418 (-0.536 to -0.299) | +0.053 | +0.059 | +0.430 |
| B4[early_release_probability=1.0,annoyed_cancel_probability=0.05] | 1 | 0.05 | 88.6% | +0.263 (+0.194 to +0.332) | +0.551 | +0.932 | -0.479 (-0.604 to -0.354) | +0.106 | +0.007 | +0.418 |
| ORACLE[early_release_probability=0.25] | 0.25 | 0.02 | 98.6% | +0.105 (+0.070 to +0.140) | +0.144 | +0.144 | -0.023 (-0.064 to +0.017) | +0.042 | +0.055 | +0.109 |
| ORACLE[early_release_probability=0.5] | 0.5 | 0.02 | 98.1% | +0.223 (+0.176 to +0.270) | +0.288 | +0.288 | -0.040 (-0.088 to +0.008) | +0.071 | +0.126 | +0.219 |
| ORACLE[early_release_probability=1.0] | 1 | 0.02 | 95.4% | +0.462 (+0.408 to +0.516) | +0.580 | +0.580 | -0.083 (-0.144 to -0.022) | +0.088 | +0.258 | +0.441 |
| B4[survival_threshold=0.6] | 0.5 | 0.02 | 98.6% | +0.034 (+0.010 to +0.057) | +0.091 | +0.097 | -0.092 (-0.146 to -0.037) | +0.020 | +0.005 | +0.069 |
| B4[survival_threshold=0.7] | 0.5 | 0.02 | 96.3% | +0.065 (+0.031 to +0.100) | +0.164 | +0.196 | -0.158 (-0.225 to -0.091) | +0.035 | -0.002 | +0.124 |
| B4[survival_threshold=0.8] | 0.5 | 0.02 | 94.2% | +0.139 (+0.092 to +0.186) | +0.272 | +0.366 | -0.224 (-0.308 to -0.140) | +0.052 | +0.027 | +0.207 |
| B4[survival_threshold=0.9] | 0.5 | 0.02 | 92.3% | +0.163 (+0.102 to +0.224) | +0.390 | +0.607 | -0.227 (-0.323 to -0.131) | +0.121 | +0.011 | +0.296 |
| B5[contacts_per_round=1] | 0.5 | 0.02 | 97.6% | +0.011 (-0.011 to +0.033) | +0.063 | +0.071 | -0.051 (-0.102 to +0.000) | +0.029 | -0.002 | +0.048 |
| B5[contacts_per_round=2] | 0.5 | 0.02 | 97.3% | +0.029 (-0.003 to +0.062) | +0.106 | +0.122 | -0.103 (-0.167 to -0.040) | +0.039 | -0.004 | +0.081 |
| B5[contacts_per_round=4] | 0.5 | 0.02 | 96.2% | +0.078 (+0.039 to +0.116) | +0.179 | +0.218 | -0.143 (-0.213 to -0.074) | +0.040 | +0.017 | +0.136 |
| B5[contacts_per_round=8] | 0.5 | 0.02 | 95.4% | +0.117 (+0.072 to +0.161) | +0.239 | +0.303 | -0.198 (-0.273 to -0.122) | +0.048 | +0.021 | +0.181 |
| B4[searches_per_day=30] | 0.5 | 0.02 | 96.5% | +0.013 (-0.067 to +0.093) | +0.710 | +0.778 | +0.116 (+0.006 to +0.227) | +0.382 | -0.016 | +0.519 |
| B4[searches_per_day=60] | 0.5 | 0.02 | 94.2% | +0.139 (+0.092 to +0.186) | +0.272 | +0.366 | -0.224 (-0.308 to -0.140) | +0.052 | +0.027 | +0.207 |
| B4[searches_per_day=120] | 0.5 | 0.02 | 88.8% | +0.113 (+0.092 to +0.134) | +0.071 | +0.153 | -0.341 (-0.393 to -0.289) | -0.058 | -0.039 | +0.056 |

## Who was asked, seats per 100 searches, by what the booking would have done unasked

| Cell | Late canceller (𝓛) | Early canceller (𝓔) | Would travel (𝓝) | Ride withdrawn | No twin |
|---|---|---|---|---|---|
| B4 (run …004) | 1.06 | 3.64 | 8.19 | 0.30 | 0.80 |
| B4-KM (run …004) | 1.03 | 3.46 | 9.14 | 0.31 | 2.17 |
| B5 (run …004) | 0.34 | 1.82 | 2.71 | 0.11 | 0.14 |
| B5-RANDOM (run …004) | 0.33 | 1.02 | 2.71 | 0.09 | 0.06 |
| ORACLE (run …003) | 2.08 | 0.00 | 0.00 | 0.03 | 0.04 |
| B4 (run …012) | 1.06 | 3.64 | 8.19 | 0.30 | 0.80 |
| ORACLE (run …012) | 2.08 | 0.00 | 0.00 | 0.03 | 0.04 |
| B4 (run …014) | 1.57 | 2.97 | 9.02 | 0.31 | 0.90 |
| ORACLE (run …014) | 2.69 | 0.00 | 0.00 | 0.06 | 0.11 |
| B4 (run …016) | 2.10 | 1.95 | 9.56 | 0.34 | 0.89 |
| ORACLE (run …016) | 3.48 | 0.00 | 0.00 | 0.06 | 0.18 |
| B4[early_release_probability=0.25,annoyed_cancel_probability=0.0] | 1.10 | 3.70 | 8.37 | 0.30 | 0.36 |
| B4[early_release_probability=0.25,annoyed_cancel_probability=0.02] | 1.10 | 3.70 | 8.36 | 0.30 | 0.41 |
| B4[early_release_probability=0.25,annoyed_cancel_probability=0.05] | 1.10 | 3.69 | 8.36 | 0.30 | 0.50 |
| B4[early_release_probability=0.5,annoyed_cancel_probability=0.0] | 1.06 | 3.65 | 8.20 | 0.30 | 0.75 |
| B4[early_release_probability=0.5,annoyed_cancel_probability=0.02] | 1.06 | 3.64 | 8.19 | 0.30 | 0.80 |
| B4[early_release_probability=0.5,annoyed_cancel_probability=0.05] | 1.06 | 3.64 | 8.18 | 0.30 | 0.90 |
| B4[early_release_probability=1.0,annoyed_cancel_probability=0.0] | 1.01 | 3.55 | 7.89 | 0.29 | 1.52 |
| B4[early_release_probability=1.0,annoyed_cancel_probability=0.02] | 1.01 | 3.55 | 7.88 | 0.29 | 1.56 |
| B4[early_release_probability=1.0,annoyed_cancel_probability=0.05] | 1.01 | 3.54 | 7.87 | 0.29 | 1.63 |
| ORACLE[early_release_probability=0.25] | 2.09 | 0.00 | 0.00 | 0.03 | 0.03 |
| ORACLE[early_release_probability=0.5] | 2.08 | 0.00 | 0.00 | 0.03 | 0.04 |
| ORACLE[early_release_probability=1.0] | 2.04 | 0.00 | 0.00 | 0.03 | 0.10 |
| B4[survival_threshold=0.6] | 0.27 | 1.63 | 1.69 | 0.08 | 0.05 |
| B4[survival_threshold=0.7] | 0.53 | 2.68 | 4.05 | 0.16 | 0.28 |
| B4[survival_threshold=0.8] | 1.06 | 3.64 | 8.19 | 0.30 | 0.80 |
| B4[survival_threshold=0.9] | 1.77 | 4.13 | 15.29 | 0.46 | 1.82 |
| B5[contacts_per_round=1] | 0.18 | 1.15 | 1.40 | 0.06 | 0.07 |
| B5[contacts_per_round=2] | 0.34 | 1.82 | 2.71 | 0.11 | 0.14 |
| B5[contacts_per_round=4] | 0.65 | 2.69 | 5.05 | 0.20 | 0.34 |
| B5[contacts_per_round=8] | 0.94 | 3.26 | 7.11 | 0.26 | 0.56 |
| B4[searches_per_day=30] | 1.19 | 4.21 | 9.35 | 0.33 | 0.54 |
| B4[searches_per_day=60] | 1.06 | 3.64 | 8.19 | 0.30 | 0.80 |
| B4[searches_per_day=120] | 0.82 | 3.05 | 6.46 | 0.25 | 1.33 |
