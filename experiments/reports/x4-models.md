# Experiment X4: the durability models, with intervals

Settings and readings: `experiments/configs/x4.yaml`. Hypotheses: docs/EXPERIMENT_PROTOCOL.md section 26, fixed before X4 was computed.

| Hypothesis | Rule | Holds |
|---|---|---|
| H4.1 | each hotel model that ranks bookings has a higher Harrell concordance at all lead times than within 7 days | NO |
| H4.2 | calibration-in-the-large differs, acting against not acting (paired t, p < 0.05) | yes |
| H4.3 | no simulator model beats Cox's Harrell concordance by more than 0.02 | yes |

## Simulator, validation seeds 2001–2010 (synthetic)

27176 training rows, 13576 evaluated. Tuned boosting: {'learning_rate': 0.1, 'max_depth': 2, 'n_estimators': 300, 'subsample': 0.8, 'random_state': 0}.

| Model | Harrell C (95% interval) | Uno C | Mean AUC | IBS | Brier at the end (95% interval) |
|---|---|---|---|---|---|
| kaplan_meier | 0.500 (0.500 to 0.500) | 0.500 | 0.500 | 0.1589 | 0.1228 (0.1191 to 0.1259) |
| cox_ph | 0.638 (0.627 to 0.652) | 0.612 | 0.545 | 0.1609 | 0.1169 (0.1130 to 0.1203) |
| gradient_boosting | 0.621 (0.610 to 0.630) | 0.599 | 0.561 | 0.1631 | 0.1182 (0.1145 to 0.1214) |
| gradient_boosting_tuned | 0.626 (0.615 to 0.636) | 0.599 | 0.562 | 0.1626 | 0.1179 (0.1144 to 0.1210) |
| random_survival_forest | 0.625 (0.612 to 0.638) | 0.594 | 0.525 | 0.1654 | 0.1181 (0.1143 to 0.1214) |

## Hotels, bookings made at most 7 days ahead, 2017 (real)

13925 training rows, 5821 evaluated. Tuned boosting: {'learning_rate': 0.1, 'max_depth': 4, 'n_estimators': 300, 'subsample': 0.8, 'random_state': 0}.

| Model | Harrell C (95% interval) | Uno C | Mean AUC | IBS | Brier at the end (95% interval) |
|---|---|---|---|---|---|
| kaplan_meier | 0.500 (0.500 to 0.500) | 0.500 | 0.500 | 0.0765 | 0.0692 (0.0568 to 0.0825) |
| cox_ph | 0.597 (0.540 to 0.641) | 0.583 | 0.670 | 0.0699 | 0.0652 (0.0544 to 0.0749) |
| cox_timing_only | 0.544 (0.505 to 0.586) | 0.553 | 0.738 | 0.0748 | 0.0689 (0.0565 to 0.0825) |
| gradient_boosting | 0.653 (0.608 to 0.697) | 0.636 | 0.707 | 0.0717 | 0.0654 (0.0543 to 0.0755) |
| gradient_boosting_tuned | 0.657 (0.607 to 0.702) | 0.641 | 0.720 | 0.0712 | 0.0655 (0.0545 to 0.0759) |
| random_survival_forest | 0.640 (0.596 to 0.679) | 0.624 | 0.597 | 0.0750 | 0.0668 (0.0548 to 0.0771) |

## Hotels, every lead time, 2017 (real)

78703 training rows, 40687 evaluated. Tuned boosting: {'learning_rate': 0.1, 'max_depth': 4, 'n_estimators': 300, 'subsample': 0.8, 'random_state': 0}.

| Model | Harrell C (95% interval) | Uno C | Mean AUC | IBS | Brier at the end (95% interval) |
|---|---|---|---|---|---|
| kaplan_meier | 0.500 (0.500 to 0.500) | 0.500 | 0.500 | 0.2344 | 0.2280 (0.2214 to 0.2350) |
| cox_ph | 0.715 (0.696 to 0.734) | 0.690 | 0.805 | 0.1596 | 0.1739 (0.1663 to 0.1821) |
| cox_timing_only | 0.534 (0.515 to 0.555) | 0.556 | 0.699 | 0.2036 | 0.2202 (0.2144 to 0.2264) |
| gradient_boosting | 0.719 (0.701 to 0.739) | 0.701 | 0.807 | 0.1545 | 0.1692 (0.1619 to 0.1769) |
| gradient_boosting_tuned | 0.711 (0.694 to 0.728) | 0.696 | 0.802 | 0.1549 | 0.1723 (0.1642 to 0.1806) |
| random_survival_forest | 0.742 (0.721 to 0.757) | 0.721 | 0.769 | 0.1835 | 0.1708 (0.1648 to 0.1775) |

## H4.2: calibration of the logged scores

Observed share still booked at departure minus the mean logged score, per seed: acting (B4) +0.0190, not acting (B4[early_release_probability=0.0,annoyed_cancel_probability=0.0]) -0.0044; difference +0.0234, paired t over 30 seeds p = 1.3e-21.

| Tenth | Mean score, acting | Observed, acting | Mean score, not acting | Observed, not acting |
|---|---|---|---|---|
| 1 | 0.538 | 0.583 | 0.533 | 0.534 |
| 2 | 0.710 | 0.740 | 0.704 | 0.690 |
| 3 | 0.785 | 0.814 | 0.779 | 0.763 |
| 4 | 0.839 | 0.872 | 0.833 | 0.819 |
| 5 | 0.879 | 0.901 | 0.875 | 0.876 |
| 6 | 0.909 | 0.918 | 0.905 | 0.903 |
| 7 | 0.940 | 0.949 | 0.938 | 0.935 |
| 8 | 0.960 | 0.963 | 0.959 | 0.957 |
| 9 | 0.974 | 0.980 | 0.974 | 0.978 |
| 10 | 0.983 | 0.986 | 0.983 | 0.983 |
