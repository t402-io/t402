import { generateKeyPairSigner } from '@solana/signers';
import { base58 } from '@scure/base';

const signer = await generateKeyPairSigner();
// The signer has a keyPair property with the raw bytes
const privateKeyBytes = new Uint8Array(64);
// Extract from the CryptoKeyPair
const exported = await crypto.subtle.exportKey('raw', signer.keyPair.privateKey);
console.log('Address:', signer.address);
// For Solana, we need the full 64-byte secret key
// The web crypto export gives us 32 bytes, we need to combine with public key
const pubKey = await crypto.subtle.exportKey('raw', signer.keyPair.publicKey);
const combined = new Uint8Array(64);
combined.set(new Uint8Array(exported), 0);
combined.set(new Uint8Array(pubKey), 32);
console.log('SVM_PRIVATE_KEY=' + base58.encode(combined));
