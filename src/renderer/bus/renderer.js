const loadBusTimeLeft = async () => {
    const response = await fetch(
        "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=12071&ServiceNo=61",
        {
            method: "GET",
            headers: {
                AccountKey: "kMLW3vYRTY2aN47TljPPBA==",
            },
        },
    );

    const busTimeLeft = await response.json();
    const element = document.getElementById("bus-time-left");
    if (element) {
        element.innerText = JSON.stringify(busTimeLeft);
    }
};

loadBusTimeLeft();
