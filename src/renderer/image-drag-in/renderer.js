window.electronAPI.onImageUrl((url) => {
    console.log("Setting image source to:", url);
    const imgElement = document.getElementById("image");
    imgElement.src = url;
});