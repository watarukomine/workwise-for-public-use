async function checkGasResponse() {
    const GAS_URL = 'https://script.google.com/macros/s/AKfycbxAsSaNs4MO_ekVuq73N_-OioXBREtbwrNA4mkU6RkGU2hgCZYciav1QiFhVgJxRc_VkQ/exec';
    console.log("Fetching from GAS Web App...");
    
    try {
        const res = await fetch(`${GAS_URL}?range=1000&forceStaff=true`);
        const text = await res.text();
        console.log("GAS raw response snippet:", text.substring(0, 300));
        
        const json = JSON.parse(text);
        console.log(`GAS returned status: ${json.status}, data length: ${json.data ? json.data.length : 0}`);
    } catch (e: any) {
        console.error("GAS fetch error:", e);
    }
}

checkGasResponse().catch(console.error);
