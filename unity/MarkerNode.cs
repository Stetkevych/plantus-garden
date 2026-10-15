using UnityEngine;

public class MarkerNode : MonoBehaviour
{
    void OnTriggerEnter(Collider other)
    {
        if (other.CompareTag("Player"))
        {
            RouteCoordinator route = FindObjectOfType<RouteCoordinator>();
            if (route != null)
            {
                route.ReachMarker(this);
            }
        }
    }
}