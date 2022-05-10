using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using Firesplash.UnityAssets.SocketIO;
using SimpleJSON;
using UnityEngine.UI;
using UnityEngine.EventSystems;

public class ServerControl : MonoBehaviour
{
    public Text socketIdInfo;
    public GameObject playerBox;
    public List<UnitControl> units;
    public List<UnitControl> selectedUnits;
    public bool myTurn;
    public Button endTurnButton;

    public SocketIOCommunicator sioCom;

    // Start is called before the first frame update
    void Start()
    {
        sioCom = GetComponent<SocketIOCommunicator>();

        sioCom.Instance.On("connect", (payload) =>
        {
            Debug.Log("Unityn connect event");
            Debug.Log("Connected! Socket ID: " + sioCom.Instance.SocketID);

            socketIdInfo.text = "Socket ID: " + sioCom.Instance.SocketID;

            //Ollaan yhdistetty serveriin. Kerro serverille, että halutaan instansioida pelaaja

            sioCom.Instance.Emit("instantiatepl", "testidata", true);
        });

        sioCom.Instance.On("disconnect", (payload) =>
        {
            Debug.Log("Disconnected: " + payload);
        });

        sioCom.Instance.On("instantiatePlayer", (playerInfo) =>
        {
            Debug.Log("Instantiating player");
            JSONNode node = JSON.Parse(playerInfo);

            GameObject playerInstance = Instantiate(playerBox, new Vector3(node["x"], node["y"], node["z"]), Quaternion.identity);
            playerInstance.name = "PlayerBox ID: " + node["socketId"];
            playerInstance.GetComponent<UnitControl>().mySocketID = node["socketId"];
            units.Add(playerInstance.GetComponent<UnitControl>());
        });

        sioCom.Instance.On("disconnectPlayer", (playerInfo) =>
        {
            JSONNode node = JSON.Parse(playerInfo);
            Debug.Log("Disconnecting player ID " + node["socketId"]);

            UnitControl toDisconnect = null;
            foreach(UnitControl unitControl in units)
            {
                if (unitControl.mySocketID == node["socketId"])
                {
                    toDisconnect = unitControl;
                    break;
                }
            }
            if (toDisconnect != null)
            {
                units.Remove(toDisconnect);
                selectedUnits.Remove(toDisconnect);
                Destroy(toDisconnect.gameObject);
            }
        });

        sioCom.Instance.On("MOVEUNITS", (unitData) =>
        {
            JSONNode node = JSONNode.Parse(unitData);
            Debug.Log("Liikuteltava pelaaja on: " + node["Name"]);
            Debug.Log("Uusi sijainti: " + node["playerPosition"][0] + " " + node["playerPosition"][1] + " " + node["playerPosition"][2]);

            float xPos = float.Parse(node["playerPosition"][0]);
            float yPos = float.Parse(node["playerPosition"][1]);
            float zPos = float.Parse(node["playerPosition"][2]);

            GameObject.Find(node["Name"]).GetComponent<UnityEngine.AI.NavMeshAgent>().destination = new Vector3(xPos, yPos, zPos);
            GameObject.Find(node["Name"]).GetComponent<UnityEngine.AI.NavMeshAgent>().isStopped = false;
        });

        sioCom.Instance.On("ENDTURN", (playerInfo) =>
        {
            JSONNode node = JSON.Parse(playerInfo);
            Debug.Log("Player " + node["socketId"] + " turn ends");
            myTurn = false;
            endTurnButton.gameObject.SetActive(false);

            //Ilmoitetaan serverille, että vuoro päättyi, voi antaa seuraavalle.
            sioCom.Instance.Emit("TURNENDED", "testidata", true);
        });

        sioCom.Instance.On("STARTTURN", (playerInfo) =>
        {
            Debug.Log(playerInfo);
            JSONNode node = JSON.Parse(playerInfo);
            Debug.Log("Player " + node["socketId"] + " turn starts");
            myTurn = true;
            endTurnButton.gameObject.SetActive(true);
        });

        sioCom.Instance.Connect();
    }
    private void Update()
    {
        if (!myTurn) return;

        if (!EventSystem.current.IsPointerOverGameObject())
        {
            // we're not clicking on a UI object, so do your normal movement
            if (Input.GetMouseButtonUp(0))
            {
                RaycastHit hit;
                Ray ray = Camera.main.ScreenPointToRay(Input.mousePosition);
                if (Physics.Raycast(ray, out hit, Mathf.Infinity))
                {
                    if (hit.collider.CompareTag("Unit"))
                    {
                        UnitControl thisUnit = hit.collider.gameObject.GetComponent<UnitControl>();
                        if (sioCom.Instance.SocketID == thisUnit.mySocketID)
                        {

                            if (!Input.GetKey(KeyCode.LeftShift))
                            {
                                DeselectAll();
                            }

                            thisUnit.SetSelected(true);
                            selectedUnits.Add(thisUnit);
                        }
                    }
                    else if (hit.collider.CompareTag("Ground"))
                    {
                        foreach (UnitControl unit in selectedUnits)
                        {
                            Debug.Log("Move each selected");
                            unit.MoveTo(hit.point);
                        }
                    }
                }
            }
            if (Input.GetMouseButtonDown(1))
            {
                DeselectAll();
            }
        }
    }
    public void DeselectAll()
    {
        foreach(UnitControl unit in selectedUnits)
        {
            unit.SetSelected(false);
        }
        selectedUnits.Clear();
    }
    public void EndTurn()
    {
        sioCom.Instance.Emit("PLAYERENDTURN", "testidata", true);
    }
}
