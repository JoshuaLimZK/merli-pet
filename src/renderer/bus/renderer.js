// @ts-check

/**
 * @typedef {Object} BusArrivalResponse
 * @property {Object[]} Services - Array of bus services
 */

/**
 * Load bus arrival time from LTA DataMall API
 * @returns {Promise<void>}
 */
const loadBusTimeLeft = async () => {
    /** @type {Response} */
    const response = await fetch(
        "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=12071&ServiceNo=61",
        {
            method: "GET",
            headers: {
                AccountKey: "kMLW3vYRTY2aN47TljPPBA==",
            },
        },
    );

    /** @type {BusArrivalResponse} */
    const busTimeLeft = await response.json();
    /** @type {HTMLElement | null} */
    const element = document.getElementById("bus-time-left");
    if (element) {
        element.innerText = busTimeLeft.Services[0].NextBus.EstimatedArrival
            ? Math.ceil(
                  (new Date(busTimeLeft.Services[0].NextBus.EstimatedArrival) -
                      new Date()) /
                      60000,
              ) + " Mins"
            : "No Arrival Info";
    }
    const busNoElement = document.getElementById("bus-no");
    if (busNoElement) {
        busNoElement.innerText = `Bus ${busTimeLeft.Services[0].ServiceNo} arriving in`;
    }
};

loadBusTimeLeft();
setInterval(loadBusTimeLeft, 30_000);
