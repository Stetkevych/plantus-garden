using System.Collections.Generic;

public static class PlantDatabase
{
    public static Dictionary<string, PlantData> Plants = new Dictionary<string, PlantData>()
    {
        {
            "monstera_obliqua",
            new PlantData
            {
                Id = "monstera_obliqua",
                DisplayName = "Monstera Obliqua",
                SpeciesName = "Monstera obliqua",
                UnlockTier = UnlockTier.Epic,
                Element = PlantElement.Air,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Deep Green",
                    SecondaryColor = "Ivory",
                    BodyShape = "Thin trailing vine",
                    LeafStyle = "Ultra-perforated ghost leaves",
                    RarityLook = "Collector phantom plant",
                    AuraEffect = "Floating shimmer flecks",
                    IdleAnimationStyle = "Weightless drifting sway"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Phantom Split",
                    AttackDescription = "Fires razor-thin leaf crescents through the air",
                    ProjectileVisual = "Transparent green arc blades",
                    ImpactVisual = "Soft air-rip distortion",
                    SpecialEffectVisual = "Afterimage leaf clones",
                    SoundStyle = "Whisper slash"
                },
                Stats = new PlantStats
                {
                    Health = 55,
                    Attack = 88,
                    Defense = 42,
                    Speed = 95,
                    CritChance = 22,
                    EnergyCost = 18,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Glass Cannon", "High Crit", "Evasive" }
            }
        },
        {
            "monstera_albo_variegata",
            new PlantData
            {
                Id = "monstera_albo_variegata",
                DisplayName = "Monstera Albo Variegata",
                SpeciesName = "Monstera deliciosa albo variegata",
                UnlockTier = UnlockTier.Legendary,
                Element = PlantElement.Light,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "White",
                    BodyShape = "Broad climbing stalk",
                    LeafStyle = "Huge split variegated leaves",
                    RarityLook = "Luxury prestige plant",
                    AuraEffect = "Pearl light mist",
                    IdleAnimationStyle = "Elegant slow pulse"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Ivory Divide",
                    AttackDescription = "Launches shining split-leaf discs that slice and return",
                    ProjectileVisual = "White-green spinning leaf blades",
                    ImpactVisual = "Radiant cut flash",
                    SpecialEffectVisual = "Brief blind flare",
                    SoundStyle = "Clean luminous slash"
                },
                Stats = new PlantStats
                {
                    Health = 82,
                    Attack = 90,
                    Defense = 68,
                    Speed = 74,
                    CritChance = 17,
                    EnergyCost = 22,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Legendary Blade", "Blind Chance", "Balanced Power" }
            }
        },
        {
            "pink_princess",
            new PlantData
            {
                Id = "pink_princess",
                DisplayName = "Pink Princess",
                SpeciesName = "Philodendron Pink Princess",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Psychic,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Black Green",
                    SecondaryColor = "Pink",
                    BodyShape = "Elegant upright stem",
                    LeafStyle = "Glossy pink-variegated leaves",
                    RarityLook = "Royal boutique rare",
                    AuraEffect = "Pink psychic sparkles",
                    IdleAnimationStyle = "Regal heartbeat glow"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Royal Bloom Burst",
                    AttackDescription = "Releases psychic petals that detonate on contact",
                    ProjectileVisual = "Pink-black petal spiral",
                    ImpactVisual = "Heart-shaped psychic blast",
                    SpecialEffectVisual = "Confusion shimmer",
                    SoundStyle = "Soft arcane pulse"
                },
                Stats = new PlantStats
                {
                    Health = 72,
                    Attack = 81,
                    Defense = 60,
                    Speed = 74,
                    CritChance = 16,
                    EnergyCost = 20,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Balanced", "Confusion Chance", "Elegant Burst" }
            }
        },
        {
            "spiritus_sancti",
            new PlantData
            {
                Id = "spiritus_sancti",
                DisplayName = "Spiritus Sancti",
                SpeciesName = "Philodendron spiritus-sancti",
                UnlockTier = UnlockTier.Mythic,
                Element = PlantElement.Shadow,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Deep Forest Green",
                    SecondaryColor = "Black",
                    BodyShape = "Long hanging spear silhouette",
                    LeafStyle = "Narrow sacred pendant leaves",
                    RarityLook = "Forbidden relic plant",
                    AuraEffect = "Dark holy haze",
                    IdleAnimationStyle = "Silent suspended motion"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Sanctum Sever",
                    AttackDescription = "Cuts the battlefield with dark sacred leaf lances",
                    ProjectileVisual = "Shadow-green spear leaves",
                    ImpactVisual = "Black cross-shaped rupture",
                    SpecialEffectVisual = "Armor shred mark",
                    SoundStyle = "Low holy slice"
                },
                Stats = new PlantStats
                {
                    Health = 78,
                    Attack = 97,
                    Defense = 64,
                    Speed = 89,
                    CritChance = 24,
                    EnergyCost = 24,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Mythic Assassin", "Armor Break", "High Burst" }
            }
        },
        {
            "anthurium_clarinervium",
            new PlantData
            {
                Id = "anthurium_clarinervium",
                DisplayName = "Anthurium Clarinervium",
                SpeciesName = "Anthurium clarinervium",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Crystal,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Velvet Green",
                    SecondaryColor = "Silver White",
                    BodyShape = "Compact heart-leaf frame",
                    LeafStyle = "Thick velvet leaves with bright veins",
                    RarityLook = "Gemlike jungle relic",
                    AuraEffect = "Vein-glow tracing",
                    IdleAnimationStyle = "Slow crystalline glimmer"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Vein Prism",
                    AttackDescription = "Reflects a crystal beam through glowing leaf veins",
                    ProjectileVisual = "Faceted vein-light ray",
                    ImpactVisual = "Prismatic shard burst",
                    SpecialEffectVisual = "Defense hardening shell",
                    SoundStyle = "Glass pulse"
                },
                Stats = new PlantStats
                {
                    Health = 80,
                    Attack = 76,
                    Defense = 82,
                    Speed = 56,
                    CritChance = 11,
                    EnergyCost = 17,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Tanky", "Reflective", "Crystal Guard" }
            }
        },
        {
            "anthurium_warocqueanum",
            new PlantData
            {
                Id = "anthurium_warocqueanum",
                DisplayName = "Queen Anthurium",
                SpeciesName = "Anthurium warocqueanum",
                UnlockTier = UnlockTier.Legendary,
                Element = PlantElement.Shadow,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Velvet Black Green",
                    SecondaryColor = "Silver",
                    BodyShape = "Long regal draping frame",
                    LeafStyle = "Massive elongated velvet leaves",
                    RarityLook = "Queenly dark greenhouse monarch",
                    AuraEffect = "Moonlit velvet haze",
                    IdleAnimationStyle = "Slow curtain-like sweep"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Midnight Veil",
                    AttackDescription = "Drops a royal shadow curtain that crushes foes underneath",
                    ProjectileVisual = "Descending velvet shadow sheet",
                    ImpactVisual = "Dark pressure collapse",
                    SpecialEffectVisual = "Silence effect",
                    SoundStyle = "Deep velvet rush"
                },
                Stats = new PlantStats
                {
                    Health = 88,
                    Attack = 92,
                    Defense = 74,
                    Speed = 63,
                    CritChance = 15,
                    EnergyCost = 23,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Silence", "Heavy Pressure", "Royal Control" }
            }
        },
        {
            "alocasia_dragon_scale",
            new PlantData
            {
                Id = "alocasia_dragon_scale",
                DisplayName = "Alocasia Dragon Scale",
                SpeciesName = "Alocasia baginda Dragon Scale",
                UnlockTier = UnlockTier.Epic,
                Element = PlantElement.Crystal,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Emerald",
                    SecondaryColor = "Dark Bronze",
                    BodyShape = "Shielded upright stalk",
                    LeafStyle = "Textured scale-armored leaves",
                    RarityLook = "Draconic relic plant",
                    AuraEffect = "Scaled shimmer",
                    IdleAnimationStyle = "Guarded chest-like rise"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Scale Bastion",
                    AttackDescription = "Slams forward with dragon-scale armor and shard recoil",
                    ProjectileVisual = "Short-range crystal scale burst",
                    ImpactVisual = "Heavy shield shockwave",
                    SpecialEffectVisual = "Defense boost aura",
                    SoundStyle = "Stone-claw impact"
                },
                Stats = new PlantStats
                {
                    Health = 96,
                    Attack = 79,
                    Defense = 94,
                    Speed = 48,
                    CritChance = 8,
                    EnergyCost = 18,
                    Range = AttackRange.Melee
                },
                Traits = new List<string> { "Tank", "Defense Boost", "Frontline" }
            }
        },
        {
            "alocasia_frydek_variegated",
            new PlantData
            {
                Id = "alocasia_frydek_variegated",
                DisplayName = "Variegated Frydek",
                SpeciesName = "Alocasia micholitziana Frydek Variegated",
                UnlockTier = UnlockTier.Legendary,
                Element = PlantElement.Light,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Velvet Green",
                    SecondaryColor = "Cream White",
                    BodyShape = "Elegant spearleaf frame",
                    LeafStyle = "Arrowhead velvet variegated blades",
                    RarityLook = "Rare ceremonial plant",
                    AuraEffect = "Soft ivory radiance",
                    IdleAnimationStyle = "Smooth poised sway"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Ivory Lance",
                    AttackDescription = "Fires concentrated spear-like leaf beams with piercing force",
                    ProjectileVisual = "Cream-white arrow beam",
                    ImpactVisual = "Piercing radiant spike",
                    SpecialEffectVisual = "Pierce-through trail",
                    SoundStyle = "Sharp gleaming thrust"
                },
                Stats = new PlantStats
                {
                    Health = 74,
                    Attack = 91,
                    Defense = 62,
                    Speed = 84,
                    CritChance = 19,
                    EnergyCost = 21,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Piercing", "Fast Striker", "Elite Rare" }
            }
        },
        {
            "colocasia_black_magic",
            new PlantData
            {
                Id = "colocasia_black_magic",
                DisplayName = "Colocasia Black Magic",
                SpeciesName = "Colocasia esculenta Black Magic",
                UnlockTier = UnlockTier.Epic,
                Element = PlantElement.Shadow,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Black Purple",
                    SecondaryColor = "Plum",
                    BodyShape = "Broad elephant-ear mass",
                    LeafStyle = "Huge dark heart-shaped leaves",
                    RarityLook = "Witch swamp giant",
                    AuraEffect = "Murky violet fog",
                    IdleAnimationStyle = "Slow ominous fan"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Bog Eclipse",
                    AttackDescription = "Unleashes a heavy dark wave that slows and crushes enemies",
                    ProjectileVisual = "Rolling black-violet shadow surf",
                    ImpactVisual = "Swamp burst splash",
                    SpecialEffectVisual = "Slow field residue",
                    SoundStyle = "Heavy wet boom"
                },
                Stats = new PlantStats
                {
                    Health = 102,
                    Attack = 84,
                    Defense = 86,
                    Speed = 38,
                    CritChance = 7,
                    EnergyCost = 22,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Slow", "AoE Bruiser", "Heavy Control" }
            }
        },
        {
            "calathea_white_fusion",
            new PlantData
            {
                Id = "calathea_white_fusion",
                DisplayName = "Calathea White Fusion",
                SpeciesName = "Calathea White Fusion",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Water,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "White Green",
                    SecondaryColor = "Lavender",
                    BodyShape = "Graceful layered cluster",
                    LeafStyle = "Painted marbled leaves",
                    RarityLook = "Dreamlike greenhouse spirit",
                    AuraEffect = "Mist ribbons",
                    IdleAnimationStyle = "Prayer-leaf fold pulse"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Mist Ribbon",
                    AttackDescription = "Wraps enemies in swirling moisture-charged leaf bands",
                    ProjectileVisual = "White mist spirals",
                    ImpactVisual = "Soft splash burst",
                    SpecialEffectVisual = "Accuracy reduction haze",
                    SoundStyle = "Gentle water sweep"
                },
                Stats = new PlantStats
                {
                    Health = 70,
                    Attack = 69,
                    Defense = 64,
                    Speed = 80,
                    CritChance = 13,
                    EnergyCost = 15,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Support", "Accuracy Debuff", "Evasive" }
            }
        },
        {
            "maranta_leuconeura",
            new PlantData
            {
                Id = "maranta_leuconeura",
                DisplayName = "Prayer Plant",
                SpeciesName = "Maranta leuconeura",
                UnlockTier = UnlockTier.Common,
                Element = PlantElement.Light,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "Red",
                    BodyShape = "Low layered rosette",
                    LeafStyle = "Patterned prayer leaves",
                    RarityLook = "Sacred starter support",
                    AuraEffect = "Soft pulse halo",
                    IdleAnimationStyle = "Leaves folding like hands"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Sanctuary Pulse",
                    AttackDescription = "Emits a rhythmic wave that heals allies and nudges enemies back",
                    ProjectileVisual = "Expanding light rings",
                    ImpactVisual = "Small healing spark pop",
                    SpecialEffectVisual = "Ally heal glow",
                    SoundStyle = "Warm pulse hum"
                },
                Stats = new PlantStats
                {
                    Health = 76,
                    Attack = 52,
                    Defense = 66,
                    Speed = 58,
                    CritChance = 6,
                    EnergyCost = 12,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Healer", "Starter Support", "Team Utility" }
            }
        },
        {
            "stromanthe_triostar",
            new PlantData
            {
                Id = "stromanthe_triostar",
                DisplayName = "Stromanthe Triostar",
                SpeciesName = "Stromanthe sanguinea Triostar",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Light,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "Pink Cream",
                    BodyShape = "Tall colorful plume",
                    LeafStyle = "Tri-colored painterly leaves",
                    RarityLook = "Festival rare plant",
                    AuraEffect = "Color streak motes",
                    IdleAnimationStyle = "Ribbon-like leaf dance"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Triflare Fan",
                    AttackDescription = "Fans out triple-toned blades of light in a spread attack",
                    ProjectileVisual = "Three-color leaf shards",
                    ImpactVisual = "Color burst splash",
                    SpecialEffectVisual = "Morale boost aura",
                    SoundStyle = "Bright slicing flutter"
                },
                Stats = new PlantStats
                {
                    Health = 78,
                    Attack = 74,
                    Defense = 61,
                    Speed = 83,
                    CritChance = 15,
                    EnergyCost = 17,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Spread Shot", "Team Buff", "Fast Support DPS" }
            }
        },
        {
            "begonia_maculata",
            new PlantData
            {
                Id = "begonia_maculata",
                DisplayName = "Begonia Maculata",
                SpeciesName = "Begonia maculata",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Psychic,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Dark Olive",
                    SecondaryColor = "Silver White",
                    BodyShape = "Tall cane stalk",
                    LeafStyle = "Polka-dotted angel wing leaves",
                    RarityLook = "Fashion-forward duelist",
                    AuraEffect = "Silver spot sparkle",
                    IdleAnimationStyle = "Sharp poised sway"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Silver Stipple",
                    AttackDescription = "Flicks a rapid volley of spot-lit needle shots",
                    ProjectileVisual = "Silver dot bullets",
                    ImpactVisual = "Pinpoint pop flashes",
                    SpecialEffectVisual = "Multi-hit tracer lines",
                    SoundStyle = "Quick chic tic-tic"
                },
                Stats = new PlantStats
                {
                    Health = 66,
                    Attack = 86,
                    Defense = 52,
                    Speed = 90,
                    CritChance = 20,
                    EnergyCost = 16,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Rapid Fire", "High Speed", "Crit Pressure" }
            }
        },
        {
            "begonia_amphioxus",
            new PlantData
            {
                Id = "begonia_amphioxus",
                DisplayName = "Begonia Amphioxus",
                SpeciesName = "Begonia amphioxus",
                UnlockTier = UnlockTier.Epic,
                Element = PlantElement.Poison,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Lime Green",
                    SecondaryColor = "Red",
                    BodyShape = "Thin alien cluster",
                    LeafStyle = "Spotted blade-like leaves",
                    RarityLook = "Laboratory mutant plant",
                    AuraEffect = "Toxic pollen sparks",
                    IdleAnimationStyle = "Nervous twitching flare"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Spore Needle Storm",
                    AttackDescription = "Sprays toxic red-spotted leaf darts and corrosive spores",
                    ProjectileVisual = "Needle leaves and pollen spray",
                    ImpactVisual = "Small venom pops",
                    SpecialEffectVisual = "Poison cloud residue",
                    SoundStyle = "Hissing scatter"
                },
                Stats = new PlantStats
                {
                    Health = 61,
                    Attack = 89,
                    Defense = 44,
                    Speed = 92,
                    CritChance = 21,
                    EnergyCost = 18,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Poison", "Assassin", "DoT Pressure" }
            }
        },
        {
            "ficus_elastica_tineke",
            new PlantData
            {
                Id = "ficus_elastica_tineke",
                DisplayName = "Rubber Plant Tineke",
                SpeciesName = "Ficus elastica Tineke",
                UnlockTier = UnlockTier.Common,
                Element = PlantElement.Nature,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "Cream Pink",
                    BodyShape = "Thick upright trunk",
                    LeafStyle = "Broad glossy rubber leaves",
                    RarityLook = "Stable polished house guardian",
                    AuraEffect = "Gloss sheen pulse",
                    IdleAnimationStyle = "Firm grounded sway"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Latex Guard",
                    AttackDescription = "Whips dense rubber leaves and coats the field with sticky sap",
                    ProjectileVisual = "Sap-coated leaf lash",
                    ImpactVisual = "Sticky slap burst",
                    SpecialEffectVisual = "Slow adhesive patch",
                    SoundStyle = "Dense rubber snap"
                },
                Stats = new PlantStats
                {
                    Health = 90,
                    Attack = 68,
                    Defense = 79,
                    Speed = 49,
                    CritChance = 8,
                    EnergyCost = 14,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Tanky", "Slow Effect", "Reliable Frontliner" }
            }
        },
        {
            "ficus_audrey",
            new PlantData
            {
                Id = "ficus_audrey",
                DisplayName = "Ficus Audrey",
                SpeciesName = "Ficus benghalensis Audrey",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Nature,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Soft Green",
                    SecondaryColor = "Pale Beige",
                    BodyShape = "Refined trunk and crown",
                    LeafStyle = "Velvety oval leaves",
                    RarityLook = "Wise banyan noble",
                    AuraEffect = "Dusty golden calm glow",
                    IdleAnimationStyle = "Measured elder sway"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Banyan Command",
                    AttackDescription = "Summons rooting pressure from beneath the enemy",
                    ProjectileVisual = "Ground root surge",
                    ImpactVisual = "Earthen crack burst",
                    SpecialEffectVisual = "Root bind",
                    SoundStyle = "Deep wooden groan"
                },
                Stats = new PlantStats
                {
                    Health = 94,
                    Attack = 73,
                    Defense = 81,
                    Speed = 46,
                    CritChance = 9,
                    EnergyCost = 16,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Root", "Tank Controller", "Elder Guard" }
            }
        },
        {
            "hoya_kerrii",
            new PlantData
            {
                Id = "hoya_kerrii",
                DisplayName = "Hoya Kerrii",
                SpeciesName = "Hoya kerrii",
                UnlockTier = UnlockTier.Common,
                Element = PlantElement.Light,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "Rose",
                    BodyShape = "Compact succulent vine",
                    LeafStyle = "Heart-shaped thick leaves",
                    RarityLook = "Cute charm plant",
                    AuraEffect = "Tiny heart motes",
                    IdleAnimationStyle = "Playful bobbing pulse"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Heart Pop",
                    AttackDescription = "Shoots bouncing heart energy that bursts in a cheerful flash",
                    ProjectileVisual = "Glowing heart pellets",
                    ImpactVisual = "Pop of pink light",
                    SpecialEffectVisual = "Minor ally shield pulse",
                    SoundStyle = "Soft toy-like pop"
                },
                Stats = new PlantStats
                {
                    Health = 64,
                    Attack = 58,
                    Defense = 58,
                    Speed = 72,
                    CritChance = 12,
                    EnergyCost = 10,
                    Range = AttackRange.Mid
                },
                Traits = new List<string> { "Cute Support", "Light Shield", "Low Cost" }
            }
        },
        {
            "hoya_linearis",
            new PlantData
            {
                Id = "hoya_linearis",
                DisplayName = "Hoya Linearis",
                SpeciesName = "Hoya linearis",
                UnlockTier = UnlockTier.Rare,
                Element = PlantElement.Air,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Soft Green",
                    SecondaryColor = "Silver",
                    BodyShape = "Hanging curtain vine",
                    LeafStyle = "Thin cascading needle leaves",
                    RarityLook = "Cloudlike suspended plant",
                    AuraEffect = "Wind thread ribbons",
                    IdleAnimationStyle = "Floating waterfall drift"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Cloud Thread",
                    AttackDescription = "Unspools cutting wind-filaments from suspended vines",
                    ProjectileVisual = "Fine silver wind strings",
                    ImpactVisual = "Cross-thread slice marks",
                    SpecialEffectVisual = "Speed boost current",
                    SoundStyle = "Soft slicing breeze"
                },
                Stats = new PlantStats
                {
                    Health = 60,
                    Attack = 80,
                    Defense = 45,
                    Speed = 94,
                    CritChance = 18,
                    EnergyCost = 15,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Very Fast", "Wind DPS", "Speed Buff" }
            }
        },
        {
            "hoya_carnosa_compacta",
            new PlantData
            {
                Id = "hoya_carnosa_compacta",
                DisplayName = "Hoya Compacta",
                SpeciesName = "Hoya carnosa compacta",
                UnlockTier = UnlockTier.Common,
                Element = PlantElement.Nature,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Dark Green",
                    SecondaryColor = "Wax Pink",
                    BodyShape = "Twisted rope vine mass",
                    LeafStyle = "Curled compact wax leaves",
                    RarityLook = "Knotted strange charm plant",
                    AuraEffect = "Wax shine flicker",
                    IdleAnimationStyle = "Coiled tightening motion"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Vine Coil Crush",
                    AttackDescription = "Wraps and squeezes targets with dense living rope",
                    ProjectileVisual = "Extending spiral vine lash",
                    ImpactVisual = "Binding squeeze pulse",
                    SpecialEffectVisual = "Crush bind",
                    SoundStyle = "Tense vine creak"
                },
                Stats = new PlantStats
                {
                    Health = 85,
                    Attack = 70,
                    Defense = 73,
                    Speed = 51,
                    CritChance = 9,
                    EnergyCost = 13,
                    Range = AttackRange.Melee
                },
                Traits = new List<string> { "Bind", "Bruiser", "Durable" }
            }
        },
        {
            "dischidia_nummularia",
            new PlantData
            {
                Id = "dischidia_nummularia",
                DisplayName = "String of Nickels",
                SpeciesName = "Dischidia nummularia",
                UnlockTier = UnlockTier.Common,
                Element = PlantElement.Crystal,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "Silver",
                    BodyShape = "Trailing coin-vine",
                    LeafStyle = "Small round coin leaves",
                    RarityLook = "Lucky hanging charm",
                    AuraEffect = "Coin-like shimmer sparks",
                    IdleAnimationStyle = "Light dangling bounce"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Nickel Barrage",
                    AttackDescription = "Launches hardened coin leaves in a ricochet volley",
                    ProjectileVisual = "Spinning silver-green discs",
                    ImpactVisual = "Ricochet spark flash",
                    SpecialEffectVisual = "Bonus hit bounce",
                    SoundStyle = "Tink-tink snap"
                },
                Stats = new PlantStats
                {
                    Health = 62,
                    Attack = 67,
                    Defense = 55,
                    Speed = 78,
                    CritChance = 14,
                    EnergyCost = 11,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Ricochet", "Cheap Skill", "Harass" }
            }
        },
        {
            "string_of_turtles",
            new PlantData
            {
                Id = "string_of_turtles",
                DisplayName = "String of Turtles",
                SpeciesName = "Peperomia prostrata",
                UnlockTier = UnlockTier.Starter,
                Element = PlantElement.Nature,
                Aesthetic = new PlantAesthetic
                {
                    PrimaryColor = "Green",
                    SecondaryColor = "Dark Mosaic",
                    BodyShape = "Tiny crawling vine",
                    LeafStyle = "Mini turtle-shell leaves",
                    RarityLook = "Starter scout plant",
                    AuraEffect = "Tiny leaf spark trail",
                    IdleAnimationStyle = "Quick creeping wiggle"
                },
                PowerVisual = new PlantPowerVisual
                {
                    AttackName = "Shell Scatter",
                    AttackDescription = "Scatters tiny hardened leaf shells in quick succession",
                    ProjectileVisual = "Mini shell-like seed shots",
                    ImpactVisual = "Rapid pebble pops",
                    SpecialEffectVisual = "Evasion boost pulse",
                    SoundStyle = "Light skittering taps"
                },
                Stats = new PlantStats
                {
                    Health = 58,
                    Attack = 60,
                    Defense = 50,
                    Speed = 88,
                    CritChance = 13,
                    EnergyCost = 8,
                    Range = AttackRange.Long
                },
                Traits = new List<string> { "Starter", "Fast Scout", "Low Cost" }
            }
        }
    };
}