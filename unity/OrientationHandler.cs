using UnityEngine;

public class OrientationHandler : MonoBehaviour
{
    public float turnSpeed = 10f;

    void Update()
    {
        float h = Input.GetAxis("Horizontal");

        if (h != 0)
        {
            Quaternion targetRot = Quaternion.Euler(0, transform.eulerAngles.y + h * 90f, 0);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRot, turnSpeed * Time.deltaTime);
        }
    }
}