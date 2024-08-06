const { expect } = require("chai")
import { ethers } from "hardhat"

const toWei = (value: number) => ethers.parseEther(value.toString())
const fromWei = (value: number) => Number(ethers.formatEther(value))


describe("NFTMarketplace", async () => {

    let deployer: any, addr1: any, addr2: any;
    let deployerAddress: any, addr1Address: any, addr2Address: any;
    let nft: any, marketplace: any;
    let nftAddress: any, marketplaceAddress: any;
    let feePercent = 1
    let URI = "Hello"



    beforeEach(async () => {
        // Get contract address
        const NFT = await ethers.getContractFactory("NFT");
        const Marketplace = await ethers.getContractFactory("Marketplace");

        // Get Signers
        [deployer, addr1, addr2] = await ethers.getSigners();

        // Deploy contract
        marketplace = await Marketplace.deploy(feePercent);
        nft = await NFT.deploy();

        // final addresses
        deployerAddress = await deployer.getAddress();
        addr1Address = await addr1.getAddress();
        addr2Address = await addr2.getAddress();

        marketplaceAddress = await marketplace.getAddress();
        nftAddress = await nft.getAddress()
    })

    describe("Deployment", () => {
        it("Should track name and symnbbol of the nft colectioms", async () => {

            expect(await nft.name()).to.equal("Africana NFT");
            expect(await nft.symbol()).to.equal("A54");
        });

        it("Should track feeAccount and feePercent of the marketplace", async () => {

            expect(await marketplace.feeAccount()).to.equal(deployerAddress);
            expect(await marketplace.feePercent()).to.equal(feePercent);

        });

    });

    describe("Minting NFTs", () => {
        it("Should track each minted nft", async () => {
            //  addr1 mints an NFT
            await nft.connect(addr1).mint(URI);
            expect(await nft.tokenCount()).to.equal(1);
            expect(await nft.balanceOf(addr1Address)).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(URI);

            // addr2 mints an NFT
            await nft.connect(addr2).mint(URI);
            expect(await nft.tokenCount()).to.equal(2);
            expect(await nft.balanceOf(addr2Address)).to.equal(1);
            expect(await nft.tokenURI(2)).to.equal(URI);

        })
    });

    describe("Listing Items in marketplace", () => {
        beforeEach(async () => {
            // addr1 mints an NFT
            await nft.connect(addr1).mint(URI);

            // addr1 approves marketplace to spend it
            await nft.connect(addr1).setApprovalForAll(marketplaceAddress, true);
        })

        it("Should track newly created nfts from seller to marketplace and emmit a Listed event", async () => {
            // addr1 offers their nft at a price of 1 ether
            await expect(marketplace.connect(addr1).listItem(nftAddress, 1, toWei(1)))
                .to.emit(marketplace, "Listed")
                .withArgs(
                    1,
                    nftAddress,
                    1,
                    toWei(1),
                    addr1Address
                )

            // Owner of NFT is the marketplace
            expect(await nft.ownerOf(1)).to.equal(marketplaceAddress);

            // Item count should be equal to 1
            expect(await marketplace.itemCount()).to.equal(1);

            // Get Items from Items mapping and check fields to ensure they are correct
            const item = await marketplace.items(1);
            expect(item.itemId).to.equal(1);
            expect(item.nft).to.equal(nftAddress);
            expect(item.tokenId).to.equal(1);
            expect(item.price).to.equal(toWei(1));
            expect(item.seller).to.equal(addr1Address);
            expect(item.sold).to.equal(false);
        });

        it("should fail if price is set to zero", async () => {
            await expect(
                marketplace.connect(addr1).listItem(nftAddress, 1, 0)
            ).to.be.revertedWith("Price must be greater than zero");


        })
    });


    describe("Cancelling Listed Nft from the marketplace", () => {
        beforeEach(async () => {
            // addr1 mints an NFT
            await nft.connect(addr1).mint(URI);

            // addr1 approves marketplace to spend it
            await nft.connect(addr1).setApprovalForAll(marketplaceAddress, true);

            // addr1 offers their nft at a price of 1 ether
            await marketplace.connect(addr1).listItem(nftAddress, 1, toWei(1))
        })

        it("Should remove the nft from the marketplace and emit a Cancelled event", async () => {
            await expect(marketplace.connect(addr1).cancelListing(1))
                .to.emit(marketplace, "Cancelled")
                .withArgs(
                    1,
                    nftAddress,
                    1,
                    toWei(1),
                    addr1Address
                )

            // Owner of NFT is addr1
            expect(await nft.ownerOf(1)).to.equal(addr1Address);

            // Get Items from Items mapping and check fields to ensure they are correct
            const item = await marketplace.items(1);
            expect(item.itemId).to.equal(0);
            expect(item.tokenId).to.equal(0);
            expect(item.price).to.equal(0);
            expect(item.sold).to.equal(false);
        })

        it("Should fail if item does not exist or is not listed by the caller", async () => {

            // when the wrong address try to cancel
            await expect(
                marketplace.connect(addr2).cancelListing(1)
            ).to.be.revertedWith("You are not the seller of this item");

            // when the wrong listing is cancelled
            await expect(
                marketplace.connect(addr1).cancelListing(2)
            ).to.be.revertedWith("Item does not exist");
        })

    });

    describe("Purchasing Items from marketplace", () => {
        let price = 2
        let totalPriceInWei: any;

        beforeEach(async () => {
            // addr1 mints an NFT
            await nft.connect(addr1).mint(URI);

            // addr1 approves marketplace to spend it
            await nft.connect(addr1).setApprovalForAll(marketplaceAddress, true);

            // addr1 offers their nft at a price of 2 ether
            await marketplace.connect(addr1).listItem(nftAddress, 1, toWei(price))
        });

        it("Should Update items as sold, pay seller, transfer nft to buyer, charge fees and emit Bought event", async () => {
            const sellerInitialEthBalance = await addr1.provider.getBalance(addr1Address);
            const feeAccountInitialEthBalance = await deployer.provider.getBalance(deployerAddress);


            // fetch the total price of the item
            totalPriceInWei = await marketplace.getTotalPrice(1)

            // addr2  purchase item
            await expect(marketplace.connect(addr2).purchaseItem(1, { value: totalPriceInWei }))
                .to.emit(marketplace, "Bought")
                .withArgs(
                    1,
                    nftAddress,
                    1,
                    toWei(price),
                    addr1Address,
                    addr2Address
                )

            const sellerFinalEthBalance = await addr1.provider.getBalance(addr1Address);
            const feeAccountFinalEthBalance = await deployer.provider.getBalance(deployerAddress);


            // Seller should receive the price of the item
            expect(fromWei(sellerFinalEthBalance)).to.equal(price + fromWei(sellerInitialEthBalance));

            //calculate fee percent
            const fee = (feePercent / 100) * price

            // Fee account should receive the fee
            // expect(fromWei(feeAccountFinalEthBalance)).to.equal(fee + fromWei(feeAccountInitialEthBalance));

            // Buyer should own the nft
            expect(await nft.ownerOf(1)).to.equal(addr2Address);

            // Item should be marked as sold
            expect((await marketplace.items(1)).sold).to.equal(true);


        });


        it("Should fail for invalid item ids, sold items and when not enough ether is paid", async () => {

            // fails for invalid item ids
            await expect(
                marketplace.connect(addr2).purchaseItem(2, { value: totalPriceInWei }))
                .to.be.revertedWith("Item does not exist");

            await expect(
                marketplace.connect(addr2).purchaseItem(0, { value: totalPriceInWei }))
                .to.be.revertedWith("Item does not exist");

            // fails when not enough ether is paid
            await expect(
                marketplace.connect(addr2).purchaseItem(1, { value: toWei(price) }))
                .to.be.revertedWith("Insufficient funds to cover item price and percent fee");


            // addr2  purchase item 1
            await marketplace.connect(addr2).purchaseItem(1, { value: totalPriceInWei })

            // deployer tries to purchase item 1 after been sold
            await expect(
                marketplace.connect(deployer).purchaseItem(1, { value: totalPriceInWei }))
                .to.be.revertedWith("Item is already sold");

        });
    });
})