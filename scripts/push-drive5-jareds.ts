import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const scan = await prisma.cryptoDriveScan.create({
    data: {
      label: "223GB NTFS — Jared's Office (ETH Wallet + Electrum + Seeds)",
      devicePath: "/dev/sda4",
      filesystem: "ntfs",
      totalSizeGb: 223,
      scanStatus: "complete",
      scanDuration: 10,
      notes: [
        "CRITICAL DRIVE — Jared's Office machine. Multiple wallet apps + seed phrases in plain text.",
        "Robert.txt: 24-word BTC seed, 12-word seed, numbered 24-word seed, Monero address, 3 ETH addresses, password hint 'Digitalgold256'.",
        "Electrum installed: 3 encrypted wallet files (default_wallet, wallet_1, wallet_2). BIE1 encrypted.",
        "Ethereum Wallet (Mist) installed with Geth binary.",
        "ETH keystore on Desktop: 0x317388... (0.009 ETH on-chain).",
        "Robert's ETH: 0x3026... (0.001 ETH, noted 319.44 ETH historical). Old MEW: 0xD78C... (empty). Old: 0xa509... (0.049 ETH — same as Drive 1).",
        "SSH RSA private key: KeyPairs/ubunto_test.pem.",
        "Sticky Notes (Windows.old): Grafana creds (digie/Jpc2N5Xe), mining farm specs (5600 cards, 750-1500 KVA, $160K ASIC buildout, $40K electric).",
        "Digital Gold LLC paycheck records for 2018.",
      ].join("\n"),
      itemCount: 0,
      items: {
        create: [
          {
            category: "seed_phrase", subcategory: "bip39-24", sensitivity: "critical",
            filePath: "/Users/Jareds Office/Desktop/Robert.txt",
            contentPreview: "agre...urge",
            extractedData: { wordCount: 24, type: "BIP39 24-word (Bitcoin)", source: "Robert.txt" },
            notes: "24-word BIP39 seed phrase (BTC) in Robert.txt. PLAINTEXT.",
          },
          {
            category: "seed_phrase", subcategory: "bip39-12", sensitivity: "critical",
            filePath: "/Users/Jareds Office/Desktop/Robert.txt",
            contentPreview: "king...nway",
            extractedData: { wordCount: 12, type: "BIP39 12-word", source: "Robert.txt" },
            notes: "12-word BIP39 seed phrase in Robert.txt. PLAINTEXT.",
          },
          {
            category: "seed_phrase", subcategory: "bip39-24-numbered", sensitivity: "critical",
            filePath: "/Users/Jareds Office/Desktop/Robert.txt",
            contentPreview: "obvi...kiwi",
            extractedData: { wordCount: 24, type: "BIP39 24-word (numbered)", source: "Robert.txt", notes: "Possibly Cobo Vault hardware wallet seed." },
            notes: "Numbered 24-word BIP39 seed in Robert.txt. Possibly Cobo Vault. PLAINTEXT.",
          },
          {
            category: "address", subcategory: "monero", sensitivity: "sensitive",
            filePath: "/Users/Jareds Office/Desktop/Robert.txt",
            contentPreview: "Monero: 43fLKA...Qpy",
            extractedData: {
              address: "43fLKAHrknM4WQPYKC5Kyq98NksubyH7Lh6nqoygDdkZKeuCWSgzU7yD9KJQJcCrq6jR1qDGCrtGSD139Eng9imE92nKQpy",
              network: "monero",
            },
            notes: "Monero (XMR) address from Robert.txt.",
          },
          {
            category: "address", subcategory: "ethereum", sensitivity: "sensitive",
            filePath: "/Users/Jareds Office/Desktop/Robert.txt",
            contentPreview: "Robert: 0x3026...531b (0.001 ETH)",
            extractedData: {
              address: "0x3026e5dca7a3f50a482d5f06fb18ce607386531b",
              balanceETH: 0.001217,
              explorerUrl: "https://etherscan.io/address/0x3026e5dca7a3f50a482d5f06fb18ce607386531b",
              label: "Robert (historical note: 319.44 ETH)",
            },
            notes: "Robert's ETH address. 0.001 ETH on-chain. Robert.txt notes 319.44 ETH — likely historical balance.",
          },
          {
            category: "address", subcategory: "ethereum", sensitivity: "sensitive",
            filePath: "/Users/Jareds Office/Desktop/Robert.txt",
            contentPreview: "Old MEW: 0xD78C...8c10",
            extractedData: {
              address: "0xD78C27B25504247797004037a9b8aC246b4c8c10",
              balanceETH: 0,
              explorerUrl: "https://etherscan.io/address/0xD78C27B25504247797004037a9b8aC246b4c8c10",
              label: "Old MyEtherWallet",
            },
            notes: "Old MyEtherWallet address — empty.",
          },
          {
            category: "keystore", subcategory: "ethereum", sensitivity: "critical",
            filePath: "/Users/Jareds Office/Desktop/UTC--2018-04-04T18-28-46.json",
            contentPreview: "addr: 0x3173...cdf3",
            extractedData: {
              address: "0x317388812d4976e44e2d04aedfcac41931d0cdf3",
              balanceETH: 0.009259,
              explorerUrl: "https://etherscan.io/address/0x317388812d4976e44e2d04aedfcac41931d0cdf3",
              needsPassword: true,
            },
            notes: "ETH keystore — 0.009 ETH on-chain. Needs password.",
          },
          {
            category: "crypto_dir", subcategory: "electrum", sensitivity: "critical",
            filePath: "/Users/Jareds Office/AppData/Roaming/Electrum/wallets/",
            extractedData: {
              walletFiles: ["default_wallet", "wallet_1", "wallet_2"],
              encryption: "BIE1 (password encrypted)",
              needsPassword: true,
            },
            notes: "3 Electrum BTC wallets (encrypted). Try password: Digitalgold256.",
          },
          {
            category: "private_key", subcategory: "ssh-rsa", sensitivity: "sensitive",
            filePath: "/KeyPairs/ubunto_test.pem",
            extractedData: { type: "RSA Private Key (PEM)", label: "ubunto_test.pem" },
            notes: "RSA SSH private key. Likely for cloud mining instances.",
          },
          {
            category: "document", subcategory: "credentials", sensitivity: "sensitive",
            filePath: "/Windows.old/StickyNotes/plum.sqlite",
            extractedData: {
              grafana: { url: "https://grafana.virtx.ro/", user: "digie", password: "Jpc2N5Xe" },
              miningFarm: "5600 cards, 750-1500 KVA, $160K ASIC buildout, $40K/mo electric",
            },
            notes: "Sticky Notes: Grafana mining dashboard creds + large-scale mining farm specs.",
          },
          {
            category: "document", subcategory: "financial", sensitivity: "normal",
            filePath: "/Users/Jareds Office/Documents/Paycheck to Jared and Expenses from Digital Gold LLC - 2018.txt",
            notes: "Digital Gold LLC paycheck records — 2018. Tax relevance.",
          },
        ],
      },
    },
    include: { items: true },
  });
  await prisma.cryptoDriveScan.update({ where: { id: scan.id }, data: { itemCount: scan.items.length } });
  console.log(`Drive scan: ${scan.id} (${scan.items.length} items)`);

  const newWallets = [
    { provider: "keystore-drive", network: "ethereum", address: "0x317388812d4976e44e2d04aedfcac41931d0cdf3", balanceUsd: 0, mode: "recovery",
      balances: { ETH: 0.009259, explorerUrl: "https://etherscan.io/address/0x317388812d4976e44e2d04aedfcac41931d0cdf3", source: "Jared's Office — Desktop keystore", needsPassword: true } },
    { provider: "robert-txt", network: "ethereum", address: "0x3026e5dca7a3f50a482d5f06fb18ce607386531b", balanceUsd: 0, mode: "recovery",
      balances: { ETH: 0.001217, explorerUrl: "https://etherscan.io/address/0x3026e5dca7a3f50a482d5f06fb18ce607386531b", source: "Jared's Office — Robert.txt", label: "Robert (historical: 319.44 ETH)" } },
    { provider: "robert-txt", network: "ethereum", address: "0xD78C27B25504247797004037a9b8aC246b4c8c10", balanceUsd: 0, mode: "recovery",
      balances: { ETH: 0, explorerUrl: "https://etherscan.io/address/0xD78C27B25504247797004037a9b8aC246b4c8c10", source: "Jared's Office — Robert.txt (Old MEW)" } },
    { provider: "robert-txt", network: "monero", address: "43fLKAHrknM4WQPYKC5Kyq98NksubyH7Lh6nqoygDdkZKeuCWSgzU7yD9KJQJcCrq6jR1qDGCrtGSD139Eng9imE92nKQpy", balanceUsd: 0, mode: "recovery",
      balances: { XMR: null, source: "Jared's Office — Robert.txt" } },
    { provider: "electrum", network: "bitcoin", address: "electrum-jareds-office-3wallets", balanceUsd: 0, mode: "recovery",
      balances: { BTC: null, source: "Jared's Office — 3 Electrum wallets (BIE1 encrypted)", needsPassword: true, hint: "Try Digitalgold256" } },
    { provider: "seed-phrase", network: "bitcoin", address: "seed-robert-txt-24word-btc", balanceUsd: 0, mode: "recovery",
      balances: { BTC: null, source: "Robert.txt — 24-word BTC seed (plaintext)", note: "Derive with BIP44/49/84 to find addresses" } },
    { provider: "seed-phrase", network: "multi", address: "seed-robert-txt-12word", balanceUsd: 0, mode: "recovery",
      balances: { source: "Robert.txt — 12-word seed (plaintext)", note: "Unknown wallet origin. Derive with BIP44." } },
    { provider: "seed-phrase", network: "multi", address: "seed-robert-txt-24word-numbered", balanceUsd: 0, mode: "recovery",
      balances: { source: "Robert.txt — numbered 24-word seed (plaintext)", note: "Possibly Cobo Vault hardware wallet." } },
  ];
  for (const w of newWallets) {
    const existing = await prisma.cryptoWallet.findFirst({ where: { address: w.address } });
    if (!existing) {
      await prisma.cryptoWallet.create({ data: w });
      console.log(`  Created: ${w.address.slice(0, 20)}... (${w.network})`);
    } else {
      console.log(`  Exists: ${w.address.slice(0, 20)}...`);
    }
  }
  console.log("Done.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
