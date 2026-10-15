using UnityEngine;

public class CombatModule : MonoBehaviour
{
    public float attackRange = 3f;
    public int damage = 20;
    public LayerMask targetMask;

    void Update()
    {
        if (Input.GetMouseButtonDown(0))
        {
            AttemptAttack();
        }
    }

    void AttemptAttack()
    {
        Ray ray = new Ray(transform.position + Vector3.up, transform.forward);
        RaycastHit hit;

        if (Physics.Raycast(ray, out hit, attackRange, targetMask))
        {
            TargetModule target = hit.collider.GetComponent<TargetModule>();
            if (target != null)
            {
                target.ReceiveImpact(damage);
            }
        }
    }
}