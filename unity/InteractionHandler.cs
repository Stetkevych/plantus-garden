using UnityEngine;

public class InteractionHandler : MonoBehaviour
{
    public float range = 3f;

    void Update()
    {
        if (Input.GetKeyDown(KeyCode.E))
        {
            Ray ray = new Ray(transform.position, transform.forward);
            RaycastHit hit;

            if (Physics.Raycast(ray, out hit, range))
            {
                if (hit.collider.CompareTag("ModeTrigger"))
                {
                    StateCoordinator sc = FindObjectOfType<StateCoordinator>();
                    sc.SetMode(StateCoordinator.Mode.Race);
                }
            }
        }
    }
}