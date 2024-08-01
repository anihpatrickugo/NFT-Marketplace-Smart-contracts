import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFT", (m) => {
    const marketplace = m.contract("Marketplace", [2]);

    // m.call(marketplace, "mint", ["hello"]);

    return { marketplace };
});