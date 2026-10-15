using UnityEngine;

public class HealthModule : MonoBehaviour
{
    public int maxHealth = 100;
    private int currentHealth;

    void Start()
    {
        currentHealth = maxHealth;
    }

    public void TakeDamage(int amount)
    {
        currentHealth -= amount;

        if (currentHealth <= 0)
        {
            EventRouter.PlayerDied();
            Destroy(gameObject);
        }
    }
}