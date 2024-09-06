await wait();

async function wait() {
  await new Promise((resolve) => setTimeout(resolve, 3000));
}
