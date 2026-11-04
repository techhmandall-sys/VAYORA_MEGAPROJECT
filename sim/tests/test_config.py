import copy

import pytest
import yaml

from sim.config import ConfigError, load_variant, load_world
from sim.frozen import LATENT_TYPES
from sim.run import CONFIGS
from sim.simulator import RANKINGS

WORLD = CONFIGS / "world.yaml"


def _world_with(tmp_path, change):
    raw = yaml.safe_load(WORLD.read_text(encoding="utf-8"))
    change(raw)
    path = tmp_path / "world.yaml"
    path.write_text(yaml.safe_dump(raw), encoding="utf-8")
    return path


def test_the_shipped_world_loads_and_has_exactly_the_four_latent_types():
    world = load_world(WORLD)

    assert tuple(world.demand.types) == LATENT_TYPES
    assert world.start.utcoffset() is not None
    assert sum(kind.share for kind in world.demand.types.values()) == pytest.approx(1.0)


def test_every_shipped_variant_loads_and_names_a_known_ranking():
    variants = sorted((CONFIGS / "variants").glob("*.yaml"))

    assert variants
    for path in variants:
        variant = load_variant(path)
        assert variant.name == path.stem
        assert variant.ranking in RANKINGS


def test_an_unknown_key_is_an_error_not_a_silent_default(tmp_path):
    def typo(raw):
        raw["supply"]["rides_per_dya"] = raw["supply"].pop("rides_per_day")

    with pytest.raises(ConfigError, match="rides_per_dya"):
        load_world(_world_with(tmp_path, typo))


def test_a_missing_key_is_an_error(tmp_path):
    with pytest.raises(ConfigError, match="hazard_multiplier"):
        load_world(_world_with(
            tmp_path, lambda raw: raw["demand"]["shock"].pop("hazard_multiplier")))


def test_latent_types_cannot_be_added_or_removed(tmp_path):
    def add(raw):
        raw["demand"]["types"]["tourist"] = copy.deepcopy(raw["demand"]["types"]["committed"])

    with pytest.raises(ConfigError, match="demand.types"):
        load_world(_world_with(tmp_path, add))
    with pytest.raises(ConfigError, match="demand.types"):
        load_world(_world_with(tmp_path, lambda raw: raw["demand"]["types"].pop("flexible")))


@pytest.mark.parametrize("change", [
    lambda raw: raw["demand"]["types"]["committed"].update(share=0.9),
    lambda raw: raw["supply"].update(accept_probability=1.2),
    lambda raw: raw["demand"]["types"]["flexible"].update(weibull_shape=0),
    lambda raw: raw["supply"].update(rides_per_day=0),
    lambda raw: raw["supply"].update(departure_hours={24: 1}),
    lambda raw: raw.update(start="2026-01-05T00:00:00"),
    lambda raw: raw["demand"]["flexible_booking"].update(share=1.5),
    lambda raw: raw["demand"]["flexible_booking"].update(window_hours=-1),
    lambda raw: raw["demand"]["last_mile"].update(offer_beyond_metres=-1),
    lambda raw: raw["demand"]["last_mile"].update(offset_metres_sigma=0),
    lambda raw: raw["demand"]["types"]["opportunistic"].update(last_mile_sensitivity=-0.1),
    lambda raw: raw["demand"]["proximity"].update(share=1.0),
    lambda raw: raw["demand"]["proximity"].update(share=-0.1),
    lambda raw: raw["demand"]["proximity"].update(scale_hours=0),
    lambda raw: raw["demand"]["types"]["flexible"].update(proximity_rate=-0.01),
])
def test_nonsense_values_are_rejected(tmp_path, change):
    with pytest.raises(ConfigError):
        load_world(_world_with(tmp_path, change))


B5_TEXT = (CONFIGS / "variants" / "B5.yaml").read_text(encoding="utf-8")


def test_a_contact_budget_is_loaded_whole_or_not_at_all(tmp_path):
    budget = load_variant(CONFIGS / "variants" / "B5.yaml").intervention.budget
    assert (budget.contacts_per_round, budget.max_contacts_per_ride) == (2, 1)
    assert load_variant(CONFIGS / "variants" / "B4.yaml").intervention.budget is None
    assert budget.chooser == "scheduler"
    assert load_variant(CONFIGS / "variants" / "B5-RANDOM.yaml").intervention.budget.chooser == "random"

    path = tmp_path / "B5.yaml"
    path.write_text(B5_TEXT.replace("contacts_per_round", "contacts_per_ruond"), encoding="utf-8")
    with pytest.raises(ConfigError, match="contacts_per_ruond"):
        load_variant(path)
    path.write_text(B5_TEXT.replace("    refill_horizon_hours: 168\n", ""), encoding="utf-8")
    with pytest.raises(ConfigError, match="refill_horizon_hours"):
        load_variant(path)
    path.write_text(B5_TEXT.replace("contacts_per_round: 2", "contacts_per_round: 0"), encoding="utf-8")
    with pytest.raises(ConfigError, match="at least 1"):
        load_variant(path)
    path.write_text(B5_TEXT.replace("solver_time_limit_seconds: 5", "solver_time_limit_seconds: 0"),
                    encoding="utf-8")
    with pytest.raises(ConfigError, match="positive"):
        load_variant(path)
