using UnityEngine;

public class ViewHandler : MonoBehaviour
{
    public Transform target;
    public Vector3 offset = new Vector3(0, 5, -8);
    public float smoothFactor = 5f;

    void LateUpdate()
    {
        Vector3 desired = target.position + offset;
        Vector3 smoothed = Vector3.Lerp(transform.position, desired, smoothFactor * Time.deltaTime);

        transform.position = smoothed;
        transform.LookAt(target);
    }
}