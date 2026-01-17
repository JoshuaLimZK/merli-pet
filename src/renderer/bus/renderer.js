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
        element.innerText = JSON.stringify(busTimeLeft);
    }
};

loadBusTimeLeft();
