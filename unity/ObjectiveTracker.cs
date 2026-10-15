using UnityEngine;

public class ObjectiveTracker : MonoBehaviour
{
    public int currentObjective = 0;

    public void AdvanceObjective()
    {
        currentObjective++;
        Debug.Log("Objective: " + currentObjective);
    }
}