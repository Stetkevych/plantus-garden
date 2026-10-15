using System.Collections.Generic;

public enum PlantElement
{
    Nature,
    Poison,
    Water,
    Fire,
    Shadow,
    Light,
    Electric,
    Psychic,
    Crystal,
    Air
}

public enum AttackRange
{
    Melee,
    Mid,
    Long
}

public enum UnlockTier
{
    Starter,
    Common,
    Rare,
    Epic,
    Legendary,
    Mythic
}

public class PlantAesthetic
{
    public string PrimaryColor;
    public string SecondaryColor;
    public string BodyShape;
    public string LeafStyle;
    public string RarityLook;
    public string AuraEffect;
    public string IdleAnimationStyle;
}

public class PlantPowerVisual
{
    public string AttackName;
    public string AttackDescription;
    public string ProjectileVisual;
    public string ImpactVisual;
    public string SpecialEffectVisual;
    public string SoundStyle;
}

public class PlantStats
{
    public int Health;
    public int Attack;
    public int Defense;
    public int Speed;
    public int CritChance;
    public int EnergyCost;
    public AttackRange Range;
}

public class PlantData
{
    public string Id;
    public string DisplayName;
    public string SpeciesName;
    public UnlockTier UnlockTier;
    public PlantElement Element;

    public PlantAesthetic Aesthetic;
    public PlantPowerVisual PowerVisual;
    public PlantStats Stats;

    public List<string> Traits = new List<string>();
}