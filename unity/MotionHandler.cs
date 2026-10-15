using UnityEngine;

public class MotionHandler : MonoBehaviour
{
    public float moveSpeed = 6f;
    public float gravity = -9.81f;
    public float jumpForce = 1.5f;

    public Transform groundProbe;
    public float probeRadius = 0.4f;
    public LayerMask surfaceMask;
    public Transform cameraReference;

    private CharacterController controller;
    private Vector3 velocity;
    private bool grounded;

    void Start()
    {
        controller = GetComponent<CharacterController>();
    }

    void Update()
    {
        grounded = Physics.CheckSphere(groundProbe.position, probeRadius, surfaceMask);

        if (grounded && velocity.y < 0)
        {
            velocity.y = -2f;
        }

        float x = Input.GetAxis("Horizontal");
        float z = Input.GetAxis("Vertical");

        Vector3 forward = cameraReference.forward;
        Vector3 right = cameraReference.right;

        forward.y = 0f;
        right.y = 0f;

        forward.Normalize();
        right.Normalize();

        Vector3 move = forward * z + right * x;

        if (move.magnitude > 0.1f)
        {
            transform.forward = move.normalized;
        }

        controller.Move(move * moveSpeed * Time.deltaTime);

        if (Input.GetButtonDown("Jump") && grounded)
        {
            velocity.y = Mathf.Sqrt(jumpForce * -2f * gravity);
        }

        velocity.y += gravity * Time.deltaTime;
        controller.Move(velocity * Time.deltaTime);
    }
}