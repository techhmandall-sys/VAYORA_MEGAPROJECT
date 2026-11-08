# Experiment X5: robustness

Synthetic data (simulator), 30 paired seeds per cell, each against its own baseline. Sweeps and readings: `experiments/configs/x5.yaml`. Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before these runs.

| Hypothesis | Rule | Holds |
|---|---|---|
| H5.1 | B4 - B3 equivalent to zero in every cell | yes |
| H5.2 | B3 - B0 wholly above zero in every cell of world h3 | yes |

## B4 − B3, completed rides per 100 searches

| Sweep | World | Cell | Difference (95% CI) | Equivalence p |
|---|---|---|---|---|
| supply-density | world.yaml | rides_per_day=6 | +0.028 (-0.008 to +0.063) | 0.0001 |
| supply-density | world.yaml | rides_per_day=12 | +0.027 (-0.018 to +0.072) | 0.0012 |
| supply-density | world.yaml | rides_per_day=20 | -0.046 (-0.081 to -0.010) | 0.0021 |
| demand-density-w05 | worlds/proximity_w0.5.yaml | searches_per_day=30 | -0.032 (-0.090 to +0.027) | 0.0120 |
| demand-density-w05 | worlds/proximity_w0.5.yaml | searches_per_day=60 | +0.050 (+0.003 to +0.098) | 0.0209 |
| demand-density-w05 | worlds/proximity_w0.5.yaml | searches_per_day=120 | +0.015 (-0.015 to +0.044) | 0.0000 |
| cancellation-scale-w05 | worlds/proximity_w0.5.yaml | scale=1 | +0.050 (+0.003 to +0.098) | 0.0209 |
| cancellation-scale-w05 | worlds/proximity_w0.5.yaml | scale=2 | +0.037 (-0.007 to +0.080) | 0.0029 |
| cancellation-scale-w05 | worlds/proximity_w0.5.yaml | scale=3 | +0.030 (-0.019 to +0.079) | 0.0034 |

## B3 − B0, completed rides per 100 searches

| Sweep | World | Cell | Difference (95% CI) | Equivalence p |
|---|---|---|---|---|
| supply-density-ranking | world.yaml | rides_per_day=6 | +0.115 (+0.052 to +0.179) | 0.6867 |
| supply-density-ranking | world.yaml | rides_per_day=12 | +0.319 (+0.220 to +0.417) | 1.0000 |
| supply-density-ranking | world.yaml | rides_per_day=20 | +0.283 (+0.191 to +0.375) | 0.9998 |
| cancellation-scale-w05-ranking | worlds/proximity_w0.5.yaml | scale=1 | +0.357 (+0.284 to +0.431) | 1.0000 |
| cancellation-scale-w05-ranking | worlds/proximity_w0.5.yaml | scale=2 | +0.365 (+0.284 to +0.445) | 1.0000 |
| cancellation-scale-w05-ranking | worlds/proximity_w0.5.yaml | scale=3 | +0.361 (+0.273 to +0.449) | 1.0000 |
