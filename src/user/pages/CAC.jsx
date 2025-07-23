import React, { useState, useEffect } from "react";
import { Form, Input, Select, DatePicker, Upload, Button, message } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import Swal from "sweetalert2";
import { config } from "../../config/config";
import CryptoJS from "crypto-js";

function CAC() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [states, setStates] = useState([]);
  const [lgas, setLgas] = useState([]);
  const [passportPreview, setPassportPreview] = useState(null);
  const [signaturePreview, setSignaturePreview] = useState(null);
  const [fileError, setFileError] = useState("");
  const [signatureError, setSignatureError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedSignature, setSelectedSignature] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState(null);
  const [isStateOpen, setIsStateOpen] = useState(false);
  const [isLgaOpen, setIsLgaOpen] = useState(false);

  // Fetch states effect
  useEffect(() => {
    fetch("https://nga-states-lga.onrender.com/fetch")
      .then((res) => res.json())
      .then((data) => setStates(data))
      .catch(() => setStates([]));
  }, []);

  // Fetch LGAs effect
  const handleStateChange = (value) => {
    fetch(`https://nga-states-lga.onrender.com/?state=${value}`)
      .then((res) => res.json())
      .then((data) => setLgas(data))
      .catch(() => setLgas([]));
  };

  const validateFile = (file, isSignature = false) => {
    const validTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      const errorMsg = "Please upload only JPG, PNG or PDF files";
      isSignature ? setSignatureError(errorMsg) : setFileError(errorMsg);
      return false;
    }

    if (file.size > 51200) {
      const errorMsg = "File size must be less than 50KB";
      isSignature ? setSignatureError(errorMsg) : setFileError(errorMsg);
      return false;
    }

    isSignature ? setSignatureError("") : setFileError("");
    return true;
  };

  const handleFileChange = (e, isSignature = false) => {
    const file = e.target.files[0];
    if (!file) return;

    if (validateFile(file, isSignature)) {
      isSignature ? setSelectedSignature(file) : setSelectedFile(file);

      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => {
          isSignature
            ? setSignaturePreviewUrl(reader.result)
            : setPreviewUrl(reader.result);
        };
        reader.readAsDataURL(file);
      } else {
        isSignature ? setSignaturePreviewUrl(null) : setPreviewUrl(null);
      }
    } else {
      e.target.value = "";
      isSignature ? setSelectedSignature(null) : setSelectedFile(null);
      isSignature ? setSignaturePreviewUrl(null) : setPreviewUrl(null);
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.onerror = (error) => {
        reject(error);
      };
    });
  };

  const SECRET_KEY = import.meta.env.VITE_APP_SECRET_KEY;

  function decryptData(ciphertext) {
    if (!ciphertext) return null;
    try {
      const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch {
      return null;
    }
  }

  const onFinish = async (values) => {
    setLoading(true);

    try {
      // Get userId from encrypted localStorage like NIN component
      let userId = null;
      try {
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const userObj = decryptData(userStr);
          userId = userObj?._id || userObj?.id;
        }
      } catch (error) {
        console.error("Error getting userId:", error);
      }

      // Convert files to base64
      let passportBase64 = null;
      let signatureBase64 = null;

      if (selectedFile) {
        const passportResult = await convertToBase64(selectedFile);
        passportBase64 = passportResult.split(",")[1];
      }

      if (selectedSignature) {
        const signatureResult = await convertToBase64(selectedSignature);
        signatureBase64 = signatureResult.split(",")[1];
      }

      // Construct payload like NIN
      const payload = {
        userId: userId,
        registrationType: values.registrationType,
        surname: values.surname,
        firstName: values.firstName,
        otherName: values.otherName || "",
        dateOfBirth: values.dob.format("YYYY-MM-DD"),
        gender: values.gender,
        phoneNumber: values.phone,
        homeAddress: values.homeAddress,
        officeAddress: values.officeAddress,
        natureOfBusiness: values.natureOfBusiness,
        businessName1: values.businessName1,
        businessName2: values.businessName2,
        businessName3: values.businessName3,
        bvn: values.bvn,
        nin: values.nin,
        email: values.email,
        stateOfOrigin: values.stateOfOrigin,
        lgaOfOrigin: values.lgaOfOrigin,
        passport: passportBase64,
        signature: signatureBase64,
      };

      // Log payload like NIN
      console.log("Sending payload:", {
        ...payload,
        passport: passportBase64,
        signature: signatureBase64,
      });

      // Make API call like NIN
      const response = await fetch(
        `${config.apiBaseUrl}${config.endpoints.cacRegistration}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify(payload),
        }
      );
      console.log("API Response Status:", response.status);

      const data = await response.json();
      console.log("API Response:", data);

      if (response.status === 200) {
        await Swal.fire({
          icon: "success",
          title: "Registration Successful!",
          text: "Your business registration has been submitted successfully.",
          confirmButtonColor: "#f59e0b",
        });

        // Reset form and previews
        form.resetFields();
        setPreviewUrl(null);
        setSignaturePreviewUrl(null);
        setSelectedFile(null);
        setSelectedSignature(null);
      } else {
        throw new Error(data.message || "Registration failed");
      }
    } catch (error) {
      console.error("Registration error:", error);

      const errorMessage = error.message.includes("Server error")
        ? error.message
        : "Failed to submit registration. Please check your internet connection and try again.";

      Swal.fire({
        icon: "error",
        title: "Registration Failed",
        text: errorMessage,
        confirmButtonColor: "#f59e0b",
        showConfirmButton: true,
      });
    } finally {
      setLoading(false);
    }
  };

  // Close the select dropdowns when clicking outside
  useEffect(() => {
    if (isStateOpen || isLgaOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isStateOpen, isLgaOpen]);

  return (
    <div className="w-full rounded-2xl mb-5 bg-white p-5 shadow-lg">
      <h2 className="text-3xl font-semibold mb-4 text-center text-amber-500">
        Business Registration Form
      </h2>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        requiredMark={true}
      >
        <Form.Item
          name="registrationType"
          label="Registration Type"
          rules={[
            { required: true, message: "Please select registration type" },
          ]}
        >
          <Select size="large">
            <Select.Option value="BN">Business Name (BN)</Select.Option>
            <Select.Option value="LLC">
              Limited Liability Company (LLC)
            </Select.Option>
            <Select.Option value="NGO">
              Non-Governmental Organization (NGO)
            </Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="surname" label="Surname" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="firstName"
          label="First Name"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item name="otherName" label="Other Name">
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="dob"
          label="Date of Birth"
          size="large"
          rules={[{ required: true }]}
        >
          <DatePicker className="w-full" />
        </Form.Item>

        <Form.Item name="gender" label="Gender" rules={[{ required: true }]}>
          <Select size="large">
            <Select.Option value="m">Male</Select.Option>
            <Select.Option value="f">Female</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="phone"
          label="Phone Number"
          rules={[
            { required: true },
            { pattern: /^\d{11}$/, message: "Phone number must be 11 digits" },
          ]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="homeAddress"
          label="Home Address"
          rules={[{ required: true }]}
        >
          <Input.TextArea size="large" />
        </Form.Item>

        <Form.Item name="officeAddress" label="Office Address">
          <Input.TextArea size="large" />
        </Form.Item>

        <Form.Item
          name="natureOfBusiness1"
          label="Nature of Business (One)"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>
        <Form.Item
          name="natureOfBusiness2"
          label="Nature of Business (Two)"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>
        <Form.Item
          name="AddressofBusiness"
          label="Address of Principal Place of Business"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>
        <Form.Item
          name="BusinessCity"
          label="City of Business"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>
        <Form.Item
          name="LGAofBusiness"
          label="Local Government Area of Business"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="businessName1"
          label="Business Name (First Choice)"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="businessName2"
          label="Business Name (Second Choice)"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>
        <Form.Item
          name="businessName3"
          label="Business Name (Third Choice)"
          rules={[{ required: true }]}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="bvn"
          label="BVN Number"
          rules={[
            { required: true },
            { pattern: /^\d{11}$/, message: "BVN must be 11 digits" },
          ]}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item name="nin" label="NIN Number" rules={[{ required: true }]}>
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="passport"
          label="Passport"
          rules={[
            {
              required: true,
              validator: (_, value) => {
                if (!selectedFile) {
                  return Promise.reject("Please upload a passport photograph");
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-center w-full">
              <label className="w-full mt-5 flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, false)}
                />
              </label>
            </div>

            {fileError && (
              <p className="mt-1 text-sm text-red-600">{fileError}</p>
            )}

            {previewUrl && (
              <div className="mt-5 relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-w-[100px] max-h-[100px] object-contain rounded border border-gray-200"
                />
              </div>
            )}

            <div className="text-xs text-gray-500 mt-2">
              File requirements:
              <ul className="list-disc ml-4 mt-1">
                <li>Maximum file size: 50KB</li>
                <li>Allowed file types: JPG, JPEG, PNG, PDF</li>
                <li>Recent passport photograph with white background</li>
              </ul>
            </div>
          </div>
        </Form.Item>

        <Form.Item
          name="email"
          label="Functional Email Address"
          rules={[
            { required: true },
            { type: "email", message: "Please enter a valid email" },
          ]}
        >
          <Input size="large" />
        </Form.Item>

        <Form.Item
          name="stateOfOrigin"
          label="State of Origin"
          rules={[{ required: true }]}
        >
          <Select
            size="large"
            onChange={handleStateChange}
            onOpenChange={(open) => setIsStateOpen(open)}
            getPopupContainer={(trigger) => trigger.parentNode}
            styles={{
              popup: {
                root: {
                  maxHeight: "50vh",
                },
              },
            }}
          >
            {states.map((state, idx) => (
              <Select.Option key={idx} value={state}>
                {state}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="lgaOfOrigin"
          label="Local Government of Origin"
          rules={[{ required: true }]}
        >
          <Select
            size="large"
            onOpenChange={(open) => setIsLgaOpen(open)}
            getPopupContainer={(trigger) => trigger.parentNode}
            styles={{
              popup: {
                root: {
                  maxHeight: "50vh",
                },
              },
            }}
          >
            {lgas.map((lga, idx) => (
              <Select.Option key={idx} value={lga}>
                {lga}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          name="signature"
          label="Signature"
          rules={[
            {
              required: true,
              validator: (_, value) => {
                if (!selectedSignature) {
                  return Promise.reject("Please upload your signature");
                }
                return Promise.resolve();
              },
            },
          ]}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-center w-full">
              <label className="w-full mt-5 flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50">
                <div className="space-y-1 text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                    aria-hidden="true"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => handleFileChange(e, true)}
                />
              </label>
            </div>

            {signatureError && (
              <p className="mt-1 text-sm text-red-600">{signatureError}</p>
            )}

            {signaturePreviewUrl && (
              <div className="mt-5 relative">
                <img
                  src={signaturePreviewUrl}
                  alt="Signature Preview"
                  className="max-w-[100px] max-h-[100px] object-contain rounded border border-gray-200"
                />
              </div>
            )}

            <div className="text-xs text-gray-500 mt-2">
              File requirements:
              <ul className="list-disc ml-4 mt-1">
                <li>Maximum file size: 50KB</li>
                <li>Allowed file types: JPG, JPEG, PNG, PDF</li>
                <li>Clear signature on white background</li>
              </ul>
            </div>
          </div>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            size="large"
            className="w-full flex items-center bg-amber-500 mt-[-5px]"
            loading={loading} // Add loading state
          >
            Submit Registration
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
}

export default CAC;
