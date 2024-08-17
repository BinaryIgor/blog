  const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

  const id = setInterval(async () => {
    // runs every 2 seconds
    await delay(1100);
    console.log("Running interval...", new Date());
  }, 1000);


//   await delay(5_000);