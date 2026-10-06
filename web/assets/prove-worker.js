/*
  Makes the Groth16 proof off the main thread, so the page stays responsive on
  a cheap phone while it works. snarkjs.min.js and the circuit files are
  served from the same origin.
*/
importScripts('snarkjs.min.js')

self.onmessage = async (event) => {
  try {
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      event.data,
      '../zk/hapax_claim.wasm',
      '../zk/hapax_claim.zkey',
    )
    self.postMessage({ ok: true, proof, publicSignals })
  } catch (e) {
    self.postMessage({ ok: false, error: String(e && e.message ? e.message : e) })
  }
}
