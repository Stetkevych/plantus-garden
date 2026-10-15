using UnityEngine;

public class ConflictCoordinator : MonoBehaviour
{
    public float detectionRadius = 5f;
    public LayerMask enemyMask;

    void Update()
    {
        Collider[] hits = Physics.OverlapSphere(transform.position, detectionRadius, enemyMask);

        if (hits.Length > 0)
        {
            StateCoordinator sc = FindObjectOfType<StateCoordinator>();
            if (sc != null && sc.currentMode != StateCoordinator.Mode.Battle)
            {
                sc.SetMode(StateCoordinator.Mode.Battle);
            }
        }
    }
}