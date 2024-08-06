// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Marketplace is ReentrancyGuard {
    // state variables
    address payable public immutable feeAccount; // The account that receives fees
    uint public immutable feePercent; // The fee percentage
    uint public itemCount;

    struct Item {
        uint itemId;
        IERC721 nft;
        uint tokenId;
        uint price;
        address payable seller;
        bool sold;
    }

    // event
    event Listed(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    );

    event Cancelled(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller
    );

    event Bought(
        uint itemId,
        address indexed nft,
        uint tokenId,
        uint price,
        address indexed seller,
        address indexed buyer
    );

    // mappings
    mapping(uint => Item) public items;

    constructor(uint _feePercent) {
        feePercent = _feePercent;
        feeAccount = payable(msg.sender);
    }

    // get listing
    function getItem(uint _itemId) external view returns (Item memory) {
        return items[_itemId];
    }

    // list items
    function listItem(
        IERC721 _nft,
        uint _tokenId,
        uint _price
    ) external nonReentrant {
        require(_price > 0, "Price must be greater than zero");
        require(
            _nft.ownerOf(_tokenId) == msg.sender,
            "You are not the owner of this token"
        );

        // increment count
        itemCount++;

        // transfer nft
        _nft.transferFrom(msg.sender, address(this), _tokenId);

        // add item to mapping
        items[itemCount] = Item(
            itemCount,
            _nft,
            _tokenId,
            _price,
            payable(msg.sender),
            false
        );

        // emit event
        emit Listed(itemCount, address(_nft), _tokenId, _price, msg.sender);
    }

    // cancel listing
    function cancelListing(uint _itemId) external nonReentrant {
        Item storage item = items[_itemId];

        require(item.itemId > 0 && _itemId <= itemCount, "Item does not exist");
        require(
            msg.sender == item.seller,
            "You are not the seller of this item"
        );
        require(!item.sold, "Item is already sold");

        // transfer nft back to seller
        item.nft.transferFrom(address(this), msg.sender, item.tokenId);

        // store item and itemId in a variable to emmit event
        Item memory _listedItemToCancel = item;

        // remove item from mapping
        delete items[_itemId];

        // emit event
        emit Cancelled(
            _listedItemToCancel.itemId,
            address(_listedItemToCancel.nft),
            _listedItemToCancel.tokenId,
            _listedItemToCancel.price,
            msg.sender
        );
    }

    // purchase item
    function purchaseItem(uint _itemId) external payable nonReentrant {
        uint _totalprice = getTotalPrice(_itemId);
        Item storage item = items[_itemId];

        require(item.itemId > 0 && _itemId <= itemCount, "Item does not exist");
        require(
            msg.value >= _totalprice,
            "Insufficient funds to cover item price and percent fee"
        );
        require(!item.sold, "Item is already sold");

        // Pay seller and fee account

        item.seller.transfer(item.price);
        feeAccount.transfer(_totalprice - item.price);

        // update item
        item.sold = true;

        // transfer nft
        item.nft.transferFrom(address(this), msg.sender, item.tokenId);

        // emit event
        emit Bought(
            _itemId,
            address(item.nft),
            item.tokenId,
            item.price,
            item.seller,
            msg.sender
        );
    }

    // get total price
    function getTotalPrice(uint _itemId) public view returns (uint) {
        return ((items[_itemId].price * (100 + feePercent)) / 100);
    }
}
