using UnityEngine;

public class TargetModule : MonoBehaviour
{
    public int integrity = 50;

    public void ReceiveImpact(int amount)
    {
        integrity -= amount;

        if (integrity <= 0)
        {
            Destroy(gameObject);
        }
    }
}