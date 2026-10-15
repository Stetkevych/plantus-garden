using UnityEngine;

public class SpawnCoordinator : MonoBehaviour
{
    public Transform spawnPoint;
    public GameObject playerPrefab;

    public void Respawn()
    {
        Instantiate(playerPrefab, spawnPoint.position, spawnPoint.rotation);
    }
}