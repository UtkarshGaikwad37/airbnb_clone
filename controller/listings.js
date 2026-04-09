const Listing = require("../models/listing.js");
const { isValidObjectId } = require("mongoose");
const axios = require("axios");

// helper function for geocoding (reusable)
async function getCoordinates(location) {
  try {
    // small delay to avoid rate limit
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const response = await axios.get(
      "https://nominatim.openstreetmap.org/search",
      {
        params: {
          q: location,
          format: "json",
          limit: 1,
        },
        headers: {
          "User-Agent": "wanderlust-app/1.0 (utkarshdev123@gmail.com)", // ✅ use real email
        },
      },
    );

    if (!response.data || response.data.length === 0) {
      return null;
    }

    const { lat, lon } = response.data[0];
    return [parseFloat(lon), parseFloat(lat)];
  } catch (err) {
    console.log("Geocoding Error:", err.message);
    return null;
  }
}

// INDEX
module.exports.index = async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index.ejs", { allListings });
};

// NEW FORM
module.exports.newListingForm = async (req, res) => {
  res.render("listings/new.ejs");
};

// CREATE
module.exports.createNewListing = async (req, res) => {
  try {
    let url = req.file.secure_url;
    let filename = req.file.public_id;

    const { title, description, price, location, country } = req.body;

    const coordinates = await getCoordinates(location);

    if (!coordinates) {
      req.flash("error", "Location not found or API blocked.");
      return res.redirect("/listings");
    }

    const newListing = new Listing({
      title,
      description,
      image: { url, filename },
      price,
      location,
      country,
      owner: req.user,
      geometry: {
        type: "Point",
        coordinates: coordinates,
      },
    });

    await newListing.save();

    req.flash("success", "New listing added successfully!");
    res.redirect("/listings");
  } catch (err) {
    console.log(err);
    req.flash("error", "Something went wrong while creating listing.");
    res.redirect("/listings");
  }
};

// SHOW
module.exports.showListing = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    req.flash("error", "Invalid listing ID.");
    return res.redirect("/listings");
  }

  const detailListing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");

  if (!detailListing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  res.render("listings/show.ejs", { detailListing });
};

// EDIT FORM
module.exports.editListingForm = async (req, res) => {
  const { id } = req.params;

  const detailListing = await Listing.findById(id);
  if (!detailListing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  res.render("listings/edit.ejs", { detailListing });
};

// UPDATE
module.exports.updateListing = async (req, res) => {
  try {
    console.log("req.file:", req.file); // Debug log
    const { id } = req.params;
    const { title, description, price, location, country } = req.body;

    let updateData = {
      title,
      description,
      price,
      location,
      country,
      owner: req.user,
    };

    // update image only if new file uploaded
    if (req.file) {
      updateData.image = {
        url: req.file.secure_url,
        filename: req.file.public_id,
      };
    }

    // update coordinates
    const coordinates = await getCoordinates(location);
    if (coordinates) {
      updateData.geometry = {
        type: "Point",
        coordinates: coordinates,
      };
    }

    const updatedListing = await Listing.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedListing) {
      req.flash("error", "Listing not found.");
      return res.redirect("/listings");
    }

    req.flash("success", "Listing updated successfully!");
    res.redirect(`/listings/${id}`);
  } catch (err) {
    console.log(err);
    req.flash("error", "Update failed.");
    res.redirect("/listings");
  }
};

// DELETE
module.exports.destroyListing = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    req.flash("error", "Invalid listing ID.");
    return res.redirect("/listings");
  }

  const listing = await Listing.findByIdAndDelete(id);

  if (!listing) {
    req.flash("error", "Listing not found.");
    return res.redirect("/listings");
  }

  req.flash("success", "Listing deleted successfully!");
  res.redirect("/listings");
};
