using System.Collections.Generic;
using System.Linq;

public class PlayerProgress
{
    public int PlayerLevel;
    public int Currency;
    public HashSet<string> UnlockedPlantIds = new HashSet<string>();
}

public static class PlantUnlockSystem
{
    public static List<string> StarterPlantIds = new List<string>
    {
        "string_of_turtles",
        "maranta_leuconeura",
        "hoya_kerrii"
    };

    public static Dictionary<UnlockTier, int> TierLevelRequirements = new Dictionary<UnlockTier, int>
    {
        { UnlockTier.Starter, 1 },
        { UnlockTier.Common, 2 },
        { UnlockTier.Rare, 5 },
        { UnlockTier.Epic, 9 },
        { UnlockTier.Legendary, 14 },
        { UnlockTier.Mythic, 20 }
    };

    public static Dictionary<UnlockTier, int> TierCurrencyCosts = new Dictionary<UnlockTier, int>
    {
        { UnlockTier.Starter, 0 },
        { UnlockTier.Common, 50 },
        { UnlockTier.Rare, 120 },
        { UnlockTier.Epic, 250 },
        { UnlockTier.Legendary, 500 },
        { UnlockTier.Mythic, 1000 }
    };

    public static void InitializeStarterPlants(PlayerProgress player)
    {
        foreach (string plantId in StarterPlantIds)
        {
            player.UnlockedPlantIds.Add(plantId);
        }

        if (player.PlayerLevel < 1)
            player.PlayerLevel = 1;
    }

    public static bool IsPlantUnlocked(PlayerProgress player, string plantId)
    {
        return player.UnlockedPlantIds.Contains(plantId);
    }

    public static bool CanUnlockPlant(PlayerProgress player, string plantId)
    {
        if (!PlantDatabase.Plants.ContainsKey(plantId))
            return false;

        if (player.UnlockedPlantIds.Contains(plantId))
            return false;

        PlantData plant = PlantDatabase.Plants[plantId];

        int requiredLevel = TierLevelRequirements[plant.UnlockTier];
        int cost = TierCurrencyCosts[plant.UnlockTier];

        return player.PlayerLevel >= requiredLevel && player.Currency >= cost;
    }

    public static bool UnlockPlant(PlayerProgress player, string plantId)
    {
        if (!CanUnlockPlant(player, plantId))
            return false;

        PlantData plant = PlantDatabase.Plants[plantId];
        int cost = TierCurrencyCosts[plant.UnlockTier];

        player.Currency -= cost;
        player.UnlockedPlantIds.Add(plantId);

        return true;
    }

    public static List<PlantData> GetUnlockedPlants(PlayerProgress player)
    {
        List<PlantData> plants = new List<PlantData>();

        foreach (string plantId in player.UnlockedPlantIds)
        {
            if (PlantDatabase.Plants.ContainsKey(plantId))
            {
                plants.Add(PlantDatabase.Plants[plantId]);
            }
        }

        return plants;
    }

    public static List<PlantData> GetPlantsAvailableAtLevel(int playerLevel)
    {
        List<PlantData> plants = new List<PlantData>();

        foreach (KeyValuePair<string, PlantData> entry in PlantDatabase.Plants)
        {
            PlantData plant = entry.Value;
            int requiredLevel = TierLevelRequirements[plant.UnlockTier];

            if (playerLevel >= requiredLevel)
            {
                plants.Add(plant);
            }
        }

        return plants;
    }

    public static List<PlantData> GetPlantsByTier(UnlockTier tier)
    {
        return PlantDatabase.Plants.Values
            .Where(p => p.UnlockTier == tier)
            .ToList();
    }

    public static int GetRequiredLevelForPlant(string plantId)
    {
        if (!PlantDatabase.Plants.ContainsKey(plantId))
            return -1;

        return TierLevelRequirements[PlantDatabase.Plants[plantId].UnlockTier];
    }

    public static int GetUnlockCostForPlant(string plantId)
    {
        if (!PlantDatabase.Plants.ContainsKey(plantId))
            return -1;

        return TierCurrencyCosts[PlantDatabase.Plants[plantId].UnlockTier];
    }

    public static List<PlantData> GetCurrentlyUnlockablePlants(PlayerProgress player)
    {
        List<PlantData> unlockablePlants = new List<PlantData>();

        foreach (KeyValuePair<string, PlantData> entry in PlantDatabase.Plants)
        {
            if (CanUnlockPlant(player, entry.Key))
            {
                unlockablePlants.Add(entry.Value);
            }
        }

        return unlockablePlants;
    }
}