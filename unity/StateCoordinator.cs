using UnityEngine;

public class StateCoordinator : MonoBehaviour
{
    public enum Mode
    {
        Hub,
        OpenWorld,
        Race,
        Battle
    }

    public Mode currentMode = Mode.OpenWorld;

    public void SetMode(Mode newMode)
    {
        currentMode = newMode;

        switch (currentMode)
        {
            case Mode.Hub:
                Debug.Log("Hub Mode");
                break;

            case Mode.OpenWorld:
                Debug.Log("Open World Mode");
                break;

            case Mode.Race:
                Debug.Log("Race Mode");
                break;

            case Mode.Battle:
                Debug.Log("Battle Mode");
                break;
        }
    }
}