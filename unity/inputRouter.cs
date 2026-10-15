using UnityEngine;

public class InputRouter : MonoBehaviour
{
    public static float Horizontal => Input.GetAxis("Horizontal");
    public static float Vertical => Input.GetAxis("Vertical");
    public static bool Jump => Input.GetButtonDown("Jump");
}