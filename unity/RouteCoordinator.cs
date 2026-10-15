using UnityEngine;

public class RouteCoordinator : MonoBehaviour
{
    public MarkerNode[] markers;
    private int currentMarkerIndex = 0;
    public bool raceActive = false;

    public void StartRoute()
    {
        currentMarkerIndex = 0;
        raceActive = true;

        ClockTracker timer = FindObjectOfType<ClockTracker>();
        if (timer != null)
        {
            timer.Begin();
        }

        Debug.Log("Route started");
    }

    public void ReachMarker(MarkerNode marker)
    {
        if (!raceActive) return;

        if (markers[currentMarkerIndex] == marker)
        {
            currentMarkerIndex++;

            if (currentMarkerIndex >= markers.Length)
            {
                raceActive = false;

                ClockTracker timer = FindObjectOfType<ClockTracker>();
                if (timer != null)
                {
                    timer.StopClock();
                }

                Debug.Log("Route complete");
            }
            else
            {
                Debug.Log("Next marker: " + currentMarkerIndex);
            }
        }
    }
}