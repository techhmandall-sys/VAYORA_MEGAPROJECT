# Experiment X1: a hazard tied to departure

Synthetic data (simulator), 30 seeds per variant. Runs and worlds: `experiments/configs/x1.yaml`.
Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before these runs.

| Hypothesis | Rule | Holds |
|---|---|---|
| H1.0 | share-0 runs write the earlier h3 runs' events, seed by seed | yes |
| H1.1 | relative gain of EARLIEST over B0 at share 0.9 below 0.5 of its value at share 0.0 | NO |
| H1.2 | ORACLE - B3 larger at share 0.9 than at share 0.0 | yes |
| H1.3 | B4 - B3 equivalent to zero at every share | NO |

## H1.0: the share-0 runs repeat the earlier runs

| Run | Earlier run | Variant | Seeds identical |
|---|---|---|---|
| `…011` | `…010` | B0 | 30 / 30 |
| `…011` | `…010` | B3 | 30 / 30 |
| `…011` | `…010` | EARLIEST | 30 / 30 |
| `…011` | `…010` | B3-KM | 30 / 30 |
| `…012` | `…004` | B0 | 30 / 30 |
| `…012` | `…004` | B3 | 30 / 30 |
| `…012` | `…004` | B4 | 30 / 30 |
| `…012` | `…003` | ORACLE | 30 / 30 |

## H1.1: EARLIEST's relative gain over B0

| Share | Relative gain |
|---|---|
| 0.0 | +1.0511% |
| 0.5 | +1.1192% |
| 0.9 | +0.9776% |

Ratio, largest share to share 0: 0.930 (bootstrap 95% interval 0.666 to 1.317).

## H1.2: ORACLE − B3

| Share | ORACLE − B3 |
|---|---|
| 0.0 | +0.126 |
| 0.5 | +0.206 |
| 0.9 | +0.251 |

Change from share 0 to the largest share, seed by seed: +0.126 (t interval +0.061 to +0.190; bootstrap +0.066 to +0.187).

## H1.3: B4 − B3 within the margin

| Share | B4 − B3 | TOST p | Equivalent |
|---|---|---|---|
| 0.0 | +0.027 (-0.018 to +0.072) | 0.0012 | yes |
| 0.5 | +0.050 (+0.003 to +0.098) | 0.0209 | yes |
| 0.9 | +0.074 (+0.017 to +0.131) | 0.1801 | no |

## Exploratory, not a hypothesis of X1: B3 − EARLIEST

Added after the runs were seen; a question for experiment X2 (H2.2), not a result.

| Share | B3 − EARLIEST (95% CI) | Bootstrap |
|---|---|---|
| 0.0 | +0.001 (-0.018 to +0.021) | -0.017 to +0.020 |
| 0.5 | +0.022 (-0.011 to +0.055) | -0.009 to +0.053 |
| 0.9 | +0.048 (+0.011 to +0.085) | +0.013 to +0.083 |

## Every variant, per share

| Share | Run: variant | Completed per 100 | vs baseline (95% CI) | Seats per 100 | Late share, passengers |
|---|---|---|---|---|---|
| 0.0 | ranking:B0 | 30.22 | baseline | 38.80 | 0.351 |
| 0.0 | ranking:B3 | 30.54 | +0.319 (+0.220 to +0.417) | 39.34 | 0.354 |
| 0.0 | ranking:EARLIEST | 30.54 | +0.318 (+0.228 to +0.407) | 39.36 | 0.353 |
| 0.0 | ranking:B3-KM | 30.53 | +0.315 (+0.226 to +0.404) | 39.36 | 0.353 |
| 0.0 | reconfirmation:B3 | 30.54 | baseline | 39.34 | 0.354 |
| 0.0 | reconfirmation:B0 | 30.22 | -0.319 (-0.417 to -0.220) | 38.80 | 0.351 |
| 0.0 | reconfirmation:B4 | 30.56 | +0.027 (-0.018 to +0.072) | 39.48 | 0.279 |
| 0.0 | reconfirmation:ORACLE | 30.66 | +0.126 (+0.085 to +0.166) | 39.57 | 0.235 |
| 0.5 | ranking:B0 | 29.98 | baseline | 38.35 | 0.483 |
| 0.5 | ranking:B3 | 30.34 | +0.357 (+0.284 to +0.431) | 38.93 | 0.486 |
| 0.5 | ranking:EARLIEST | 30.32 | +0.336 (+0.259 to +0.412) | 38.93 | 0.486 |
| 0.5 | ranking:B3-KM | 30.32 | +0.332 (+0.256 to +0.408) | 38.94 | 0.487 |
| 0.5 | reconfirmation:B3 | 30.34 | baseline | 38.93 | 0.486 |
| 0.5 | reconfirmation:B0 | 29.98 | -0.357 (-0.431 to -0.284) | 38.35 | 0.483 |
| 0.5 | reconfirmation:B4 | 30.39 | +0.050 (+0.003 to +0.098) | 39.12 | 0.379 |
| 0.5 | reconfirmation:ORACLE | 30.55 | +0.206 (+0.167 to +0.246) | 39.30 | 0.327 |
| 0.9 | ranking:B0 | 29.71 | baseline | 37.90 | 0.637 |
| 0.9 | ranking:B3 | 30.04 | +0.339 (+0.270 to +0.407) | 38.41 | 0.639 |
| 0.9 | ranking:EARLIEST | 30.00 | +0.290 (+0.213 to +0.367) | 38.41 | 0.638 |
| 0.9 | ranking:B3-KM | 29.99 | +0.289 (+0.213 to +0.364) | 38.42 | 0.638 |
| 0.9 | reconfirmation:B3 | 30.04 | baseline | 38.41 | 0.639 |
| 0.9 | reconfirmation:B0 | 29.71 | -0.339 (-0.407 to -0.270) | 37.90 | 0.637 |
| 0.9 | reconfirmation:B4 | 30.12 | +0.074 (+0.017 to +0.131) | 38.67 | 0.491 |
| 0.9 | reconfirmation:ORACLE | 30.30 | +0.251 (+0.205 to +0.297) | 38.89 | 0.430 |
