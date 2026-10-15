using UnityEngine;

public class SprintModule : MonoBehaviour
{
    public float normalSpeed = 6f;
    public float sprintSpeed = 10f;

    private MotionHandler motion;

    void Start()
    {
        motion = GetComponent<MotionHandler>();
    }

    void Update()
    {
        if (Input.GetKey(KeyCode.LeftShift))
            motion.moveSpeed = sprintSpeed;
        else
            motion.moveSpeed = normalSpeed;
    }
}