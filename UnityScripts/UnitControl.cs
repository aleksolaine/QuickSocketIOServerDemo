using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using SimpleJSON;

public class UnitControl : MonoBehaviour
{
    public string mySocketID;
    public bool selected;

    NavMeshAgent navMeshAgent;
    private void Start()
    {
        navMeshAgent = GetComponent<NavMeshAgent>();
    }
    public void SetSelected(bool selected)
    {
        this.selected = selected;
        if (selected)
        {
            GetComponent<Renderer>().material.color = Color.red;
        }
        else
        {
            GetComponent<Renderer>().material.color = Color.green;
        }
    }
    public void MoveTo(Vector3 position)
    {
        Debug.Log("Moving");
        navMeshAgent.SetDestination(position);

        JSONObject playerJSON = new JSONObject();
        playerJSON.Add("Name", gameObject.name);
        JSONArray playerPosition = new JSONArray();
        playerPosition.Add(position.x.ToString());
        playerPosition.Add(0.ToString());
        playerPosition.Add(position.z.ToString());
        playerJSON.Add("playerPosition", playerPosition);

        string playerData = playerJSON.ToString();

        GameObject.Find("ServerControl").GetComponent<ServerControl>().sioCom.Instance.Emit("MOVE", playerData, false);
    }
}
