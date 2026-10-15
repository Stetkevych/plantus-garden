using UnityEngine;

public class ClockTracker : MonoBehaviour
{
    private float elapsed = 0f;
    private bool running = false;

    void Update()
    {
        if (running)
        {
            elapsed += Time.deltaTime;
        }
    }

    public void Begin()
    {
        elapsed = 0f;
        running = true;
    }

    public void StopClock()
    {
        running = false;
        Debug.Log("Final Time: " + elapsed.ToString("F2") + " seconds");
    }

    public float GetTime()
    {
        return elapsed;
    }
}