using System;
using System.Collections.Generic;

public class CombatResult
{
    public string AttackerId;
    public string DefenderId;
    public string AttackName;

    public int BaseDamage;
    public int FinalDamage;

    public bool IsCrit;
    public bool IsDodged;
    public bool HasElementAdvantage;

    public List<string> AppliedEffects = new List<string>();
    public string Summary;
}

public static class PlantCombatLogic
{
    private static Random rng = new Random();

    public static CombatResult ResolveAttack(PlantData attacker, PlantData defender)
    {
        CombatResult result = new CombatResult
        {
            AttackerId = attacker.Id,
            DefenderId = defender.Id,
            AttackName = attacker.PowerVisual.AttackName
        };

        if (CheckDodge(attacker, defender))
        {
            result.IsDodged = true;
            result.BaseDamage = 0;
            result.FinalDamage = 0;
            result.Summary = defender.DisplayName + " dodged " + attacker.DisplayName + "'s " + attacker.PowerVisual.AttackName + ".";
            return result;
        }

        int baseDamage = CalculateBaseDamage(attacker, defender);
        result.BaseDamage = baseDamage;

        float multiplier = 1f;

        if (HasElementAdvantage(attacker.Element, defender.Element))
        {
            multiplier += 0.25f;
            result.HasElementAdvantage = true;
            result.AppliedEffects.Add("Element Advantage");
        }

        if (RollCrit(attacker))
        {
            multiplier += 0.75f;
            result.IsCrit = true;
            result.AppliedEffects.Add("Critical Hit");
        }

        ApplyTraitModifiers(attacker, defender, result, ref multiplier);

        int finalDamage = (int)Math.Round(baseDamage * multiplier);

        if (finalDamage < 1)
            finalDamage = 1;

        result.FinalDamage = finalDamage;

        result.Summary = BuildSummary(attacker, defender, result);

        return result;
    }

    public static int CalculateBaseDamage(PlantData attacker, PlantData defender)
    {
        int rawDamage = attacker.Stats.Attack - (defender.Stats.Defense / 2);

        if (rawDamage < 5)
            rawDamage = 5;

        return rawDamage;
    }

    public static bool RollCrit(PlantData attacker)
    {
        int roll = rng.Next(1, 101);
        return roll <= attacker.Stats.CritChance;
    }

    public static bool CheckDodge(PlantData attacker, PlantData defender)
    {
        int speedGap = defender.Stats.Speed - attacker.Stats.Speed;

        if (speedGap <= 0)
            return false;

        int dodgeChance = speedGap / 4;

        if (dodgeChance > 20)
            dodgeChance = 20;

        int roll = rng.Next(1, 101);
        return roll <= dodgeChance;
    }

    public static bool HasElementAdvantage(PlantElement attacker, PlantElement defender)
    {
        return
            (attacker == PlantElement.Nature && defender == PlantElement.Water) ||
            (attacker == PlantElement.Water && defender == PlantElement.Fire) ||
            (attacker == PlantElement.Fire && defender == PlantElement.Nature) ||
            (attacker == PlantElement.Light && defender == PlantElement.Shadow) ||
            (attacker == PlantElement.Shadow && defender == PlantElement.Psychic) ||
            (attacker == PlantElement.Psychic && defender == PlantElement.Crystal) ||
            (attacker == PlantElement.Crystal && defender == PlantElement.Air) ||
            (attacker == PlantElement.Air && defender == PlantElement.Poison) ||
            (attacker == PlantElement.Poison && defender == PlantElement.Nature) ||
            (attacker == PlantElement.Electric && defender == PlantElement.Water);
    }

    private static void ApplyTraitModifiers(PlantData attacker, PlantData defender, CombatResult result, ref float multiplier)
    {
        foreach (string trait in attacker.Traits)
        {
            switch (trait)
            {
                case "Glass Cannon":
                    multiplier += 0.15f;
                    result.AppliedEffects.Add("Glass Cannon Bonus");
                    break;

                case "High Crit":
                    if (result.IsCrit)
                    {
                        multiplier += 0.15f;
                        result.AppliedEffects.Add("High Crit Bonus");
                    }
                    break;

                case "Tank":
                    break;

                case "Tanky":
                    break;

                case "Piercing":
                    multiplier += 0.10f;
                    result.AppliedEffects.Add("Piercing Bonus");
                    break;

                case "Poison":
                    result.AppliedEffects.Add("Poison Applied");
                    break;

                case "Root":
                    result.AppliedEffects.Add("Root Chance");
                    break;

                case "Bind":
                    result.AppliedEffects.Add("Bind Chance");
                    break;

                case "Confusion Chance":
                    result.AppliedEffects.Add("Confusion Chance");
                    break;

                case "Blind Chance":
                    result.AppliedEffects.Add("Blind Chance");
                    break;

                case "Silence":
                    result.AppliedEffects.Add("Silence Chance");
                    break;

                case "Healer":
                    result.AppliedEffects.Add("Heal Pulse");
                    break;

                case "Rapid Fire":
                    multiplier += 0.12f;
                    result.AppliedEffects.Add("Rapid Fire Bonus");
                    break;

                case "Assassin":
                    if (attacker.Stats.Speed > defender.Stats.Speed)
                    {
                        multiplier += 0.20f;
                        result.AppliedEffects.Add("Assassin Speed Bonus");
                    }
                    break;

                case "AoE Bruiser":
                    multiplier += 0.08f;
                    result.AppliedEffects.Add("AoE Force");
                    break;

                case "Very Fast":
                    multiplier += 0.10f;
                    result.AppliedEffects.Add("Speed Strike Bonus");
                    break;
            }
        }
    }

    private static string BuildSummary(PlantData attacker, PlantData defender, CombatResult result)
    {
        string summary = attacker.DisplayName + " used " + result.AttackName + " on " + defender.DisplayName +
                         " for " + result.FinalDamage + " damage";

        if (result.IsCrit)
            summary += " (CRIT)";

        if (result.HasElementAdvantage)
            summary += " (Element Advantage)";

        if (result.AppliedEffects.Count > 0)
            summary += ". Effects: " + string.Join(", ", result.AppliedEffects);

        summary += ".";

        return summary;
    }
}