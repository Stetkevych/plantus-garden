using System;
using UnityEngine;

public class EventRouter : MonoBehaviour
{
    public static Action OnPlayerDeath;

    public static void PlayerDied()
    {
        OnPlayerDeath?.Invoke();
    }
}